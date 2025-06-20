// 尝试导入 authStateListener，如果失败则使用空函数
let authStateListener = (callback) => { callback(null); };
let currentUser = null;
// 添加同步状态变量
let isSyncing = false;
let lastSyncTime = null;
let lastSyncStatus = null;
// 添加最大重试次数常量
const MAX_SYNC_ATTEMPTS = 3;

// 尝试导入 firebase.js
import('./firebase.js').then(module => {
  authStateListener = module.authStateListener;
  console.log('成功导入 firebase.js');
  
  // 监听用户登录状态
  authStateListener(user => {
    currentUser = user;
    if (user) {
      console.log('用户已登录，准备同步便签');
      // 从云端加载便签
      loadNotesFromCloud();
    }
  });
}).catch(err => {
  console.error('无法加载 firebase.js 模块:', err);
});

// 工具函数：生成唯一ID
function uuid() {
  return 'xxxx-4xxx-yxxx-xxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getNotes() {
  try {
    return JSON.parse(localStorage.getItem('floaty_notes') || '[]');
  } catch { return []; }
}

function saveNotes(notes) {
  // 过滤掉内容为空的便签
  notes = notes.filter(note => note && note.content && note.content.trim());
  
  localStorage.setItem('floaty_notes', JSON.stringify(notes));
  // 触发storage事件，同步到其他窗口
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'floaty_notes',
    newValue: JSON.stringify(notes)
  }));
  
  // 如果用户已登录，同步到云端
  syncNotesToCloud(notes);
}

// 同步便签到云端
async function syncNotesToCloud(notes) {
  // 如果没有登录或者没有Firebase，或者正在同步中，则不执行
  if (!currentUser || !window.firebaseDB || isSyncing) return;
  
  try {
    // 设置同步状态
    isSyncing = true;
    updateSyncStatus('syncing');
    console.log('开始同步便签到云端...');
    
    // 获取当前时间戳
    const timestamp = Date.now();
    
    // 准备要保存的数据
    const notesData = {
      notes: notes,
      updatedAt: window.firebaseDB.serverTimestamp ? window.firebaseDB.serverTimestamp() : timestamp
    };
    
    // 调用Firebase同步函数
    const result = await window.firebaseDB.syncNotesToCloud(currentUser.uid, notesData);
    
    if (result && result.success) {
      // 更新同步状态
      lastSyncTime = new Date();
      lastSyncStatus = 'success';
      updateSyncStatus('success');
      console.log('便签已同步到云端');
    } else if (result && !result.success) {
      // 处理同步失败情况
      console.error('同步便签到云端失败:', result.error);
      lastSyncStatus = 'error';
      
      // 如果是离线状态，显示特殊提示
      if (result.offline) {
        updateSyncStatus('error', '网络连接已断开，将在网络恢复后自动重试');
        
        // 添加网络恢复事件监听
        window.addEventListener('online', function onlineHandler() {
          console.log('网络已恢复，尝试重新同步');
          window.removeEventListener('online', onlineHandler);
          setTimeout(() => {
            isSyncing = false;
            syncNotesToCloud(notes);
          }, 2000);
        });
      } else if (result.shouldRetry) {
        // 如果需要重试
        updateSyncStatus('error', `同步失败 (${result.attempt}/${MAX_SYNC_ATTEMPTS}): ${result.error}`);
        
        // 添加指数退避重试
        const retryDelay = Math.min(1000 * Math.pow(2, result.attempt), 30000);
        setTimeout(() => {
          isSyncing = false;
          console.log(`第 ${result.attempt} 次重试同步，延迟 ${retryDelay}ms`);
          syncNotesToCloud(notes);
        }, retryDelay);
      } else {
        // 其他错误情况
        updateSyncStatus('error', result.error || '同步失败');
      }
      return;
    }
  } catch (error) {
    console.error('同步便签到云端失败:', error);
    // 更新同步状态
    lastSyncStatus = 'error';
    updateSyncStatus('error', error.message);
    
    // 添加重试逻辑
    setTimeout(() => {
      isSyncing = false; // 重置同步状态，允许下次尝试
      if (currentUser && window.firebaseDB) {
        console.log('尝试重新同步...');
        syncNotesToCloud(notes);
      }
    }, 5000); // 5秒后重试
    return;
  } finally {
    // 确保同步状态被重置
    setTimeout(() => {
      isSyncing = false;
    }, 1000);
  }
}

// 更新同步状态指示器
function updateSyncStatus(status, errorMsg) {
  // 查找或创建同步状态指示器
  let syncIndicator = document.getElementById('sync-status-indicator');
  if (!syncIndicator) {
    syncIndicator = document.createElement('div');
    syncIndicator.id = 'sync-status-indicator';
    syncIndicator.style = 'position:fixed;bottom:70px;right:20px;padding:8px 12px;border-radius:4px;font-size:12px;z-index:100;transition:opacity 0.5s;box-shadow:0 2px 8px rgba(0,0,0,0.15);';
    document.body.appendChild(syncIndicator);
  }
  
  // 根据状态更新显示
  switch (status) {
    case 'syncing':
      syncIndicator.style.background = '#f0f9ff';
      syncIndicator.style.color = '#0369a1';
      syncIndicator.style.border = '1px solid #bae6fd';
      syncIndicator.innerHTML = '正在同步数据...';
      syncIndicator.style.display = 'block';
      syncIndicator.style.opacity = '1';
      break;
    case 'success':
      syncIndicator.style.background = '#f0fdf4';
      syncIndicator.style.color = '#166534';
      syncIndicator.style.border = '1px solid #bbf7d0';
      syncIndicator.innerHTML = `同步成功 <span style="font-size:10px;opacity:0.8;">${lastSyncTime.toLocaleTimeString()}</span>`;
      syncIndicator.style.display = 'block';
      syncIndicator.style.opacity = '1';
      // 3秒后淡出
      setTimeout(() => {
        syncIndicator.style.opacity = '0';
        setTimeout(() => {
          syncIndicator.style.display = 'none';
        }, 500);
      }, 3000);
      break;
    case 'error':
      syncIndicator.style.background = '#fef2f2';
      syncIndicator.style.color = '#b91c1c';
      syncIndicator.style.border = '1px solid #fecaca';
      syncIndicator.innerHTML = `同步失败: ${errorMsg || '网络错误'} <span style="margin-left:5px;cursor:pointer;text-decoration:underline;" onclick="retrySync()">重试</span>`;
      syncIndicator.style.display = 'block';
      syncIndicator.style.opacity = '1';
      break;
    default:
      syncIndicator.style.display = 'none';
  }
}

// 重试同步函数
window.retrySync = function() {
  if (!isSyncing && currentUser && window.firebaseDB) {
    const notes = getNotes();
    syncNotesToCloud(notes);
  }
};

// 从云端加载便签
async function loadNotesFromCloud() {
  if (!currentUser || !window.firebaseDB) return;
  
  try {
    console.log('正在从云端加载便签...');
    updateSyncStatus('syncing');
    
    // 调用Firebase加载函数
    const result = await window.firebaseDB.loadNotesFromCloud(currentUser.uid);
    
    if (result && result.notes) {
      console.log('从云端加载到便签数据:', result.notes.length, '条记录');
      
      // 获取本地便签
      const localNotes = getNotes();
      
      // 合并云端和本地便签（去重）
      const mergedNotes = mergeNotes(localNotes, result.notes);
      
      // 更新本地存储
      localStorage.setItem('floaty_notes', JSON.stringify(mergedNotes));
      
      // 触发storage事件，更新界面
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'floaty_notes',
        newValue: JSON.stringify(mergedNotes)
      }));
      
      // 更新便签列表
      updateAllNotes();
      
      // 更新同步状态
      lastSyncTime = new Date();
      lastSyncStatus = 'success';
      updateSyncStatus('success');
      
      return true;
    } else {
      console.log('云端没有便签数据或加载失败');
      updateSyncStatus('success');
      return false;
    }
  } catch (error) {
    console.error('从云端加载便签失败:', error);
    updateSyncStatus('error', error.message);
    return false;
  } finally {
    // 确保同步状态被重置
    setTimeout(() => {
      isSyncing = false;
    }, 1000);
  }
}

// 合并便签（去重并保留最新的）
function mergeNotes(localNotes, cloudNotes) {
  // 创建一个Map，键为便签ID，值为便签对象
  const notesMap = new Map();
  
  // 先添加本地便签
  localNotes.forEach(note => {
    notesMap.set(note.id, note);
  });
  
  // 再添加云端便签，如果ID已存在则比较更新时间
  cloudNotes.forEach(note => {
    const existingNote = notesMap.get(note.id);
    
    if (!existingNote || (note.updatedAt > existingNote.updatedAt)) {
      notesMap.set(note.id, note);
    }
  });
  
  // 转换回数组并按更新时间排序
  return Array.from(notesMap.values())
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// 移除 DOMContentLoaded 事件，直接执行代码
(function initFloatyNote() {
  console.log('初始化便签功能');
  
  const btn = document.getElementById('floaty-btn');
  if (!('documentPictureInPicture' in window)) {
    console.error('当前浏览器不支持全局悬浮便签 (documentPictureInPicture API)');
    if (btn) btn.disabled = true;
    // 给新建便签按钮添加提示，但允许创建内联便签
    const newBtn = document.getElementById('new-note-btn');
    if (newBtn) {
      newBtn.title = '当前浏览器不支持全局悬浮便签，将使用内联便签';
      newBtn.onclick = function() {
        console.log('浏览器不支持全局悬浮，使用内联便签替代');
        showInlineNote();
      };
    }
  } else {
    const note = document.getElementById('floaty-note');
    const textarea = note ? note.querySelector('textarea') : null;
    const newBtn = document.getElementById('new-note-btn');

    // 新建便签 - 确保按钮存在并正确绑定事件
    if (newBtn) {
      console.log('找到新建便签按钮，绑定点击事件');
      newBtn.onclick = function() {
        console.log('新建便签按钮被点击');
        openFloatyNote('');
      };
    } else {
      console.error('未找到新建便签按钮 (id="new-note-btn")');
    }
  }

  const COLORS = [
    '#fff', '#fffbe6', '#fff0f6', '#e6f7ff'
  ];

  function getNoteData(noteId) {
    if (noteId) {
      const notes = getNotes();
      const note = notes.find(n => n.id === noteId);
      if (note) {
        return {
          id: note.id,
          content: note.content || '',
          color: note.color || COLORS[0]
        };
      }
    }
    
    // 兼容旧版本的单便签
    return {
      content: localStorage.getItem('floaty_note_content') || '',
      color: localStorage.getItem('floaty_note_color') || COLORS[0]
    };
  }
  
  function saveNoteData(content, color, noteId) {
    if (!content.trim()) return;
    
    let notes = getNotes();
    
    if (noteId) {
      // 更新已有便签
      notes = notes.map(n => n.id === noteId ? { 
        ...n, 
        content, 
        color, 
        updatedAt: Date.now() 
      } : n);
    } else {
      // 创建新便签
      const newNote = {
        id: uuid(),
        content,
        color,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      notes.unshift(newNote); // 添加到数组开头
    }
    
    saveNotes(notes);
    
    // 更新主页面上的便签显示
    updateAllNotes();
  }
  
  // 更新主页面上的便签显示
  function updateMainPageNotes(content, color) {
    const userNote = document.getElementById('user-note');
    
    if (userNote) {
      if (content && content.trim()) {
        userNote.textContent = content;
        userNote.style.background = color || "#fffbe6";
        userNote.style.display = 'block';
      } else {
        userNote.style.display = 'none';
      }
    }
  }

  // 更新所有便签
  function updateAllNotes() {
    const notesList = document.getElementById('notes-list');
    if (!notesList) {
      console.error('未找到便签列表容器 (id="notes-list")');
      return;
    }
    
    const notes = getNotes();
    
    if (notes.length === 0) {
      notesList.innerHTML = '<div id="empty-tips" style="text-align:center;padding:32px 0;color:#666;line-height:1.8;margin-top:30px;">'
        + '<div style="font-size:1.2rem;font-weight:600;margin-bottom:25px;color:#2D3748;">使用说明</div>'
        + '<div style="max-width:380px;margin:0 auto;background:#f9f9f9;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">'
        + '<div style="text-align:left;">'
        + '<div style="margin-bottom:15px;display:flex;align-items:center;">'
        + '<span style="display:inline-block;width:24px;height:24px;background:#2D3748;color:#FFD166;border-radius:50%;text-align:center;line-height:24px;margin-right:10px;font-weight:bold;">1</span>'
        + '<span>点"新建便签"，创建悬浮或内联便签</span>'
        + '</div>'
        + '<div style="margin-bottom:15px;display:flex;align-items:center;">'
        + '<span style="display:inline-block;width:24px;height:24px;background:#2D3748;color:#FFD166;border-radius:50%;text-align:center;line-height:24px;margin-right:10px;font-weight:bold;">2</span>'
        + '<span>输入内容自动保存，多便签颜色切换</span>'
        + '</div>'
        + '<div style="margin-bottom:15px;display:flex;align-items:center;">'
        + '<span style="display:inline-block;width:24px;height:24px;background:#2D3748;color:#FFD166;border-radius:50%;text-align:center;line-height:24px;margin-right:10px;font-weight:bold;">3</span>'
        + '<span>可添加到主屏幕，实现离线使用体验</span>'
        + '</div>'
        + '<div style="margin-bottom:0;display:flex;align-items:center;">'
        + '<span style="display:inline-block;width:24px;height:24px;background:#2D3748;color:#FFD166;border-radius:50%;text-align:center;line-height:24px;margin-right:10px;font-weight:bold;">4</span>'
        + '<span>登录后便签内容自动同步到云端</span>'
        + '</div>'
        + '</div></div></div>';
      return;
    }
    
    let html = '';
    notes.forEach(note => {
      html += `
        <div class="note-item" data-id="${note.id}" style="background:${note.color || COLORS[0]};margin-bottom:15px;padding:12px 16px;border-radius:8px;position:relative;">
          <div class="note-content" style="word-break:break-all;margin-right:25px;">${note.content || ''}</div>
          <div class="note-actions" style="position:absolute;top:8px;right:8px;">
            <button class="delete-note-btn" data-id="${note.id}" style="background:none;border:none;cursor:pointer;padding:4px;">❌</button>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
            <div class="note-time" style="font-size:12px;color:#666;text-align:left;">
              ${new Date(note.updatedAt || Date.now()).toLocaleString()}
            </div>
            <button class="edit-note-btn" data-id="${note.id}" style="background:none;border:none;cursor:pointer;padding:4px;">🖋️</button>
          </div>
        </div>
      `;
    });
    
    notesList.innerHTML = html;
    
    // 点击便签内容区域也可以编辑
    notesList.querySelectorAll('.note-content').forEach(content => {
      content.onclick = function() {
        const noteId = this.parentNode.getAttribute('data-id');
        const note = notes.find(n => n.id === noteId);
        if (note) {
          if ('documentPictureInPicture' in window) {
            openFloatyNote(note.content, noteId);
          } else {
            showInlineNote(note.content, noteId);
          }
        }
      };
    });
    
    // 编辑按钮事件
    notesList.querySelectorAll('.edit-note-btn').forEach(btn => {
      btn.onclick = function(e) {
        e.stopPropagation();
        const noteId = this.getAttribute('data-id');
        const note = notes.find(n => n.id === noteId);
        if (note) {
          if ('documentPictureInPicture' in window) {
            openFloatyNote(note.content, noteId);
          } else {
            showInlineNote(note.content, noteId);
          }
        }
      };
    });
    
    notesList.querySelectorAll('.delete-note-btn').forEach(btn => {
      btn.onclick = function(e) {
        e.stopPropagation();
        const noteId = this.getAttribute('data-id');
        if (confirm('确定要删除这个便签吗？')) {
          const updatedNotes = notes.filter(n => n.id !== noteId);
          saveNotes(updatedNotes);
          updateAllNotes();
        }
      };
    });
    
    // 显示云同步状态（仅未登录时显示）
    const existingSyncStatus = notesList.querySelector('#sync-status');
    if (existingSyncStatus) {
      existingSyncStatus.remove();
    }
    
    // 检查用户是否已登录
    let userLoggedIn = currentUser;
    
    // 如果currentUser为空，尝试从sessionStorage或localStorage获取
    if (!userLoggedIn) {
      const sessionUser = sessionStorage.getItem('currentUser');
      const localUser = localStorage.getItem('currentUser');
      
      if (sessionUser || localUser) {
        try {
          // 尝试解析JSON数据
          userLoggedIn = sessionUser ? JSON.parse(sessionUser) : (localUser ? JSON.parse(localUser) : null);
        } catch (e) {
          console.error('解析用户信息失败:', e);
        }
      }
    }
    
    if (!userLoggedIn) {
      const syncStatus = document.createElement('div');
      syncStatus.style = 'text-align:center;margin-top:20px;font-size:12px;color:#666;';
      syncStatus.id = 'sync-status';
      syncStatus.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:8px;"><span>ℹ️ 登录后便签内容将自动同步到云端</span></div>';
      notesList.appendChild(syncStatus);
    }
  }

  window.addEventListener('storage', function(e) {
    if (e.key === 'floaty_notes') {
      updateAllNotes();
    }
  });

  // 初始化便签列表
  updateAllNotes();
  
  // 如果用户已登录，尝试从云端加载便签
  if (currentUser) {
    loadNotesFromCloud();
  }

  // 主页面弹窗初始化 Quill
  let quill;
  function showInlineNote(content, editingId) {
    let note = document.getElementById('floaty-note');
    if (!note) return;
    
    // 如果是新建便签（没有editingId），立即生成一个唯一ID
    const newNoteId = editingId || uuid();
    console.log('内联便签ID:', newNoteId, editingId ? '(编辑已有便签)' : '(新建便签)');
    
    // 设置编辑ID
    note._editingId = editingId;
    
    // 获取便签数据
    let noteData = { content: '', color: COLORS[1] };
    if (editingId) {
      noteData = getNoteData(editingId);
    }
    
    // 显示便签
    note.style.display = 'flex';
    note.style.background = noteData.color || COLORS[1];
    
    // 设置文本内容
    let textarea = document.getElementById('plain-editor');
    textarea.value = content || noteData.content || '';
    textarea.style.background = 'transparent';
    textarea.focus();
    
    // 显示内容区透明背景
    const contentOverlay = document.getElementById('content-overlay');
    if (contentOverlay) {
      contentOverlay.style.display = 'block';
    }
    
    // 颜色选择区
    let colorPicker = document.getElementById('color-picker');
    if (colorPicker) {
      colorPicker.innerHTML = '';
      COLORS.forEach(c => {
        const colorDot = document.createElement('span');
        colorDot.style = `width:22px;height:22px;border-radius:50%;border:2px solid #ccc;display:inline-block;cursor:pointer;background:${c};box-shadow:0 1px 4px #0001;`;
        if ((note.style.background||noteData.color) === c) colorDot.style.border = '2px solid #333';
        colorDot.onclick = function() {
          note.style.background = c;
          colorPicker.querySelectorAll('span').forEach(dot => dot.style.border = '2px solid #ccc');
          colorDot.style.border = '2px solid #333';
        };
        colorPicker.appendChild(colorDot);
      });
    }
    
    // 使用防抖函数，避免频繁创建便签
    let saveTimeout;
    textarea.oninput = function() {
      // 清除之前的定时器
      if (saveTimeout) clearTimeout(saveTimeout);
      
      // 设置新的定时器，输入停止1秒后自动保存
      saveTimeout = setTimeout(() => {
        const val = textarea.value;
        if (val && val.trim()) {
          if (!note._editingId) {
            // 新建便签
            saveNoteData(val, note.style.background || COLORS[1]);
          } else {
            // 更新已有便签
            saveNoteData(val, note.style.background || COLORS[1], note._editingId);
          }
        }
      }, 1000);
    };
    
    // 添加关闭按钮事件，隐藏内容区透明背景
    const closeBtn = document.getElementById('close-note-btn');
    if (closeBtn) {
      closeBtn.onclick = function() {
        note.style.display = 'none';
        // 隐藏内容区透明背景
        if (contentOverlay) {
          contentOverlay.style.display = 'none';
        }
      };
    }
  }

  if (btn) {
    btn.onclick = function() {
      openFloatyNote('');
    };
  }

  // 弹出全局悬浮便签
  function openFloatyNote(content, editingId) {
    console.log('openFloatyNote 函数被调用', { content, editingId });
    
    // 如果是新建便签（没有editingId），立即生成一个唯一ID
    const newNoteId = editingId || uuid();
    console.log('便签ID:', newNoteId, editingId ? '(编辑已有便签)' : '(新建便签)');
    
    try {
      console.log('尝试请求 PiP 窗口');
      documentPictureInPicture.requestWindow({width: 300, height: 200})
        .then(win => {
          console.log('PiP 窗口创建成功');
          try { win.resizeTo(300, 200); } catch(e){} // 兼容性处理
          const doc = win.document;
          doc.documentElement.style.height = '100%';
          doc.body.style.height = '100%';
          doc.body.style.margin = '0';
          doc.body.style.padding = '0';
          doc.body.style.border = 'none';
          doc.body.style.boxSizing = 'border-box';
          
          // 获取便签数据
          let noteData = { content: '', color: COLORS[1] };
          if (editingId) {
            noteData = getNoteData(editingId);
          }
          
          // 创建便签容器
          const noteContainer = doc.createElement('div');
          noteContainer.style = 'width:100%;height:100%;display:flex;flex-direction:column;background:' + (noteData.color || COLORS[1]) + ';border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);transition:background 0.3s ease;';
          doc.body.appendChild(noteContainer);
          
          // 创建 textarea
          const textarea = doc.createElement('textarea');
          textarea.style = 'width:100%;margin:0;padding:12px 8px 8px 8px;border:none;box-sizing:border-box;resize:none;outline:none;font-size:13px;display:block;background:transparent;flex:1;';
          textarea.value = content || noteData.content || '';
          textarea.placeholder = '请输入标签内容，下拉可切换颜色';
          textarea.autofocus = true;
          noteContainer.appendChild(textarea);
          
          // 使用新建时生成的ID或编辑时的ID
          let tempNoteId = newNoteId;
          
          // 颜色选择区
          const btnRow = doc.createElement('div');
          btnRow.style = 'display:flex;align-items:center;justify-content:center;gap:16px;min-height:32px;box-sizing:border-box;width:100%;margin:0 0 8px 0;padding:0;border:none;';
          const colorWrap = doc.createElement('div');
          colorWrap.style = 'display:flex;justify-content:center;gap:16px;align-items:center;margin-top:8px;margin-bottom:8px;width:100%';
          
          // 设置自动保存功能
          let saveTimeout;
          textarea.oninput = function() {
            // 清除之前的定时器
            if (saveTimeout) clearTimeout(saveTimeout);
            
            // 设置新的定时器，输入停止1秒后自动保存
            saveTimeout = setTimeout(() => {
              const content = textarea.value;
              const color = noteContainer.style.background;
              
              if (content && content.trim()) {
                // 检查这个ID是否已存在于便签列表中
                let notes = getNotes();
                const existingNoteIndex = notes.findIndex(n => n.id === tempNoteId);
                
                if (existingNoteIndex === -1) {
                  // 新便签，不存在，则添加
                  const newNote = {
                    id: tempNoteId,
                    content: content,
                    color: color,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                  };
                  notes.unshift(newNote);
                  console.log('自动保存创建了新便签，ID:', tempNoteId);
                } else {
                  // 已存在，则更新
                  notes[existingNoteIndex] = {
                    ...notes[existingNoteIndex],
                    content: content,
                    color: color,
                    updatedAt: Date.now()
                  };
                  console.log('自动保存更新便签，ID:', tempNoteId);
                }
                
                saveNotes(notes);
                
                // 更新主页面上的便签显示
                updateAllNotes();
                
                // 显示自动保存提示
                const autoSaveTip = doc.createElement('div');
                autoSaveTip.textContent = '已保存';
                autoSaveTip.style = 'position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,0.7);color:white;padding:4px 8px;border-radius:4px;font-size:14px;font-weight:bold;';
                noteContainer.appendChild(autoSaveTip);
                setTimeout(() => autoSaveTip.remove(), 2000);
              }
            }, 1000);
          };
          
          const colorNames = ['白色','淡黄','粉红','淡蓝'];
          COLORS.forEach((c,idx) => {
            const colorDot = doc.createElement('span');
            colorDot.style = `width:20px;height:20px;border-radius:50%;border:2px solid #ccc;display:inline-block;cursor:pointer;background:${c};box-shadow:0 1px 4px #0001;margin:0;transition:box-shadow 0.2s,transform 0.2s,border 0.2s;`;
            colorDot.title = colorNames[idx] || '';
            if ((noteData.color || COLORS[1]) === c) {
              colorDot.style.border = '2.5px solid #333';
              colorDot.style.boxShadow = '0 0 0 4px rgba(165,201,202,0.15)';
              colorDot.style.transform = 'scale(1.15)';
            }
            colorDot.onmouseover = function(){ colorDot.style.transform = 'scale(1.10)'; };
            colorDot.onmouseout = function(){
              if (noteContainer.style.background === c) {
                colorDot.style.transform = 'scale(1.15)';
              } else {
                colorDot.style.transform = 'scale(1)';
              }
            };
            colorDot.onclick = function() {
              noteContainer.style.background = c;
              colorWrap.querySelectorAll('span').forEach(dot => {
                dot.style.border = '2px solid #ccc';
                dot.style.boxShadow = '0 1px 4px #0001';
                dot.style.transform = 'scale(1)';
              });
              colorDot.style.border = '2.5px solid #333';
              colorDot.style.boxShadow = '0 0 0 4px rgba(165,201,202,0.15)';
              colorDot.style.transform = 'scale(1.15)';
              
              // 立即保存颜色变更
              const content = textarea.value;
              const color = noteContainer.style.background;
              
              if (content && content.trim()) {
                // 检查这个ID是否已存在于便签列表中
                let notes = getNotes();
                const existingNoteIndex = notes.findIndex(n => n.id === tempNoteId);
                
                if (existingNoteIndex === -1) {
                  // 新便签，不存在，则添加
                  const newNote = {
                    id: tempNoteId,
                    content: content,
                    color: color,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                  };
                  notes.unshift(newNote);
                  console.log('颜色变更，创建了新便签，ID:', tempNoteId);
                } else {
                  // 已存在，则更新
                  notes[existingNoteIndex] = {
                    ...notes[existingNoteIndex],
                    content: content,
                    color: color,
                    updatedAt: Date.now()
                  };
                  console.log('颜色变更，更新便签，ID:', tempNoteId);
                }
                
                saveNotes(notes);
                
                // 更新主页面上的便签显示
                updateAllNotes();
                
                // 显示颜色已更新提示
                const colorChangeTip = doc.createElement('div');
                colorChangeTip.textContent = '已保存';
                colorChangeTip.style = 'position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,0.7);color:white;padding:4px 8px;border-radius:4px;font-size:14px;font-weight:bold;';
                noteContainer.appendChild(colorChangeTip);
                setTimeout(() => colorChangeTip.remove(), 2000);
              }
            };
            colorWrap.appendChild(colorDot);
          });
          btnRow.appendChild(colorWrap);
          noteContainer.appendChild(btnRow);
          
          // 动态分配高度和限制最小宽高
          function layout() {
            const winH = Math.max(win.innerHeight, 150);
            const winW = Math.max(win.innerWidth, 160);
            textarea.style.height = Math.floor(winH * 0.85) + 'px';
            btnRow.style.height = Math.ceil(winH * 0.15) + 'px';
            doc.body.style.minWidth = '160px';
            doc.body.style.minHeight = '150px';
          }
          layout();
          win.addEventListener('resize', layout);
          // 去除滚动条
          const style = doc.createElement('style');
          style.textContent = 'html,body{overflow:hidden;} textarea::-webkit-scrollbar{display:none;} textarea{overflow:hidden;}';
          doc.head.appendChild(style);
        })
        .catch(e => {
          console.error('PiP 窗口创建失败:', e);
          if (window.showToast) {
            window.showToast('全局悬浮失败：' + e.message + '，请确认您使用的是最新版Chrome浏览器', 'error', 5000);
          }
        });
    } catch (e) {
      console.error('创建悬浮便签出错:', e);
      if (window.showToast) {
        window.showToast('创建悬浮便签失败: ' + e.message, 'error');
      }
    }
  }
  
  // 将函数暴露给全局
  window.openFloatyNote = openFloatyNote;
  window.showInlineNote = showInlineNote;
  
  console.log('便签功能初始化完成');
  
  // 添加自动同步功能，确保数据定期同步到云端
  function setupAutoSync() {
    // 检查是否已登录
    if (!currentUser) return;
    
    console.log('设置自动同步功能');
    
    // 定期同步（每5分钟）
    const syncInterval = setInterval(() => {
      if (currentUser && !isSyncing) {
        console.log('执行定期自动同步...');
        const notes = getNotes();
        if (notes && notes.length > 0) {
          syncNotesToCloud(notes);
        }
      }
    }, 5 * 60 * 1000);
    
    // 页面关闭前同步
    window.addEventListener('beforeunload', () => {
      if (currentUser && !isSyncing) {
        console.log('页面关闭前同步数据...');
        const notes = getNotes();
        if (notes && notes.length > 0) {
          // 使用同步方式发送请求，确保在页面关闭前完成
          navigator.sendBeacon(
            'https://tixinme.firebaseio.com/user_notes/' + currentUser.uid + '.json',
            JSON.stringify({ notes: notes, updatedAt: Date.now() })
          );
        }
      }
    });
    
    // 网络状态变化时同步
    window.addEventListener('online', () => {
      console.log('网络已恢复，执行自动同步...');
      if (currentUser && !isSyncing) {
        setTimeout(() => {
          const notes = getNotes();
          if (notes && notes.length > 0) {
            syncNotesToCloud(notes);
          }
        }, 2000);
      }
    });
    
    return syncInterval;
  }
  
  // 启动自动同步
  let autoSyncInterval;
  
  // 监听用户状态变化
  authStateListener(user => {
    // 清除之前的同步间隔
    if (autoSyncInterval) {
      clearInterval(autoSyncInterval);
      autoSyncInterval = null;
    }
    
    // 如果用户已登录，设置自动同步
    if (user) {
      autoSyncInterval = setupAutoSync();
    }
  });
})();

// 判断是否为便签窗口
if (window.location.hash === '#floaty-note-window') {
  document.body.innerHTML = '';
  const noteWin = document.createElement('div');
  noteWin.style = 'position:fixed;left:0;top:0;width:100vw;height:100vh;background:#fffbe6;box-shadow:0 2px 12px #888;border-radius:10px;padding:14px;z-index:9999;resize:both;overflow:auto;display:flex;flex-direction:column;';
  const textarea = document.createElement('textarea');
  textarea.style = 'width:100%;height:80px;border:none;background:transparent;resize:none;outline:none;font-size:15px;flex:1;';
  textarea.value = localStorage.getItem('floaty_note_content') || '';
  textarea.oninput = function() {
    localStorage.setItem('floaty_note_content', textarea.value);
    window.opener && window.opener.postMessage({type:'floaty_note_update', value:textarea.value}, '*');
  };
  noteWin.appendChild(textarea);
  // 关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭';
  closeBtn.style = 'margin-top:10px;align-self:flex-end;';
  closeBtn.onclick = function(){ window.close(); };
  noteWin.appendChild(closeBtn);
  document.body.appendChild(noteWin);
  // 监听主窗口同步
  window.addEventListener('storage', function(e){
    if(e.key==='floaty_note_content') textarea.value = e.newValue||'';
  });
  // 接收主窗口消息
  window.addEventListener('message', function(e){
    if(e.data && e.data.type==='floaty_note_update') textarea.value = e.data.value;
  });
  textarea.focus();
} else {
  // 主窗口同步逻辑
  window.addEventListener('message', function(e){
    if(e.data && e.data.type==='floaty_note_update') {
      const textarea = document.querySelector('#floaty-note textarea');
      if(textarea) textarea.value = e.data.value;
    }
  });
  const textarea = document.querySelector('#floaty-note textarea');
  if(textarea){
    textarea.value = localStorage.getItem('floaty_note_content') || '';
    textarea.oninput = function(){
      localStorage.setItem('floaty_note_content', textarea.value);
      // 通知所有便签窗口
      for(let w of window.openedNotes||[]) try{w.postMessage({type:'floaty_note_update', value:textarea.value}, '*');}catch(e){}
    };
  }
}

// 用户头像显示逻辑
const navbarMenu = document.querySelector('.navbar-menu');
if (navbarMenu) {
  let avatar = navbarMenu.querySelector('#user-avatar');
  if (!avatar) {
    avatar = document.createElement('div');
    avatar.id = 'user-avatar';
    avatar.style = 'margin-left:16px;display:flex;align-items:center;position:relative;cursor:pointer;';
    navbarMenu.appendChild(avatar);
  }
  const loginBtn = navbarMenu.querySelector('a[href="/login.html"]');
  const registerBtn = navbarMenu.querySelector('a[href="/register.html"]');
  
  // 创建用户下拉菜单
  let userDropdown = document.getElementById('user-dropdown');
  if (!userDropdown) {
    userDropdown = document.createElement('div');
    userDropdown.id = 'user-dropdown';
    userDropdown.style = 'position:absolute;top:100%;right:0;background:white;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);min-width:200px;z-index:1000;display:none;margin-top:8px;overflow:hidden;';
    avatar.appendChild(userDropdown);
  }
  
  // 确保 authStateListener 已定义
  if (typeof authStateListener === 'function') {
    authStateListener(user => {
      if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
        let url = user.photoURL;
        let name = user.displayName || user.email || '';
        avatar.innerHTML = '';
        if (url) {
          avatar.innerHTML = `<img src="${url}" alt="头像" style="width:32px;height:32px;border-radius:50%;object-fit:cover;box-shadow:0 1px 4px #0002;">`;
        } else {
          let letter = name.trim()[0] ? name.trim()[0].toUpperCase() : '?';
          avatar.innerHTML = `<div style="width:32px;height:32px;border-radius:50%;background:#FFD166;color:#2D3748;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:1.1rem;box-shadow:0 1px 4px #0002;">${letter}</div>`;
        }
        avatar.style.display = 'flex';
        
        // 重新创建下拉菜单
        userDropdown = document.createElement('div');
        userDropdown.id = 'user-dropdown';
        userDropdown.style = 'position:absolute;top:100%;right:0;background:white;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);min-width:200px;z-index:1000;display:none;margin-top:8px;overflow:hidden;';
        
        // 添加用户信息
        const userInfo = document.createElement('div');
        userInfo.style = 'padding:16px;border-bottom:1px solid #eee;';
        userInfo.innerHTML = `
          <div style="font-weight:bold;margin-bottom:4px;color:#333;">${user.displayName || '用户'}</div>
          <div style="font-size:12px;color:#666;word-break:break-all;">${user.email}</div>
        `;
        userDropdown.appendChild(userInfo);
        
        // 添加退出按钮
        const logoutBtn = document.createElement('div');
        logoutBtn.style = 'padding:12px 16px;cursor:pointer;color:#333;transition:background 0.2s;';
        logoutBtn.innerHTML = '退出登录';
        logoutBtn.onmouseover = function() { this.style.background = '#f5f5f5'; };
        logoutBtn.onmouseout = function() { this.style.background = 'transparent'; };
        logoutBtn.onclick = function() {
          if (window.firebaseAuth && window.firebaseAuth.logOut) {
            window.firebaseAuth.logOut()
              .then(() => {
                console.log('用户已退出登录');
                // 隐藏下拉菜单
                userDropdown.style.display = 'none';
              })
              .catch(error => {
                console.error('退出登录失败:', error);
                if (window.showToast) {
                  window.showToast('退出登录失败: ' + error.message, 'error');
                }
              });
          } else {
            console.error('未找到退出登录方法');
            if (window.showToast) {
              window.showToast('退出登录功能暂不可用', 'error');
            }
          }
        };
        userDropdown.appendChild(logoutBtn);
        
        avatar.appendChild(userDropdown);
        
        // 点击头像显示/隐藏下拉菜单
        avatar.onclick = function(e) {
          e.stopPropagation();
          userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
        };
        
        // 点击其他地方关闭下拉菜单
        document.addEventListener('click', function() {
          if (userDropdown) userDropdown.style.display = 'none';
        });
      } else {
        if (loginBtn) loginBtn.style.display = '';
        if (registerBtn) registerBtn.style.display = '';
        avatar.innerHTML = '';
        avatar.style.display = 'none';
      }
    });
  } else {
    console.warn('authStateListener 未定义，跳过用户头像逻辑');
    // 默认显示登录和注册按钮
    if (loginBtn) loginBtn.style.display = '';
    if (registerBtn) registerBtn.style.display = '';
    avatar.style.display = 'none';
  }
} 