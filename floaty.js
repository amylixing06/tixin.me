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
  localStorage.setItem('floaty_notes', JSON.stringify(notes));
}
function renderNotesList() {
  const notes = getNotes();
  const list = document.getElementById('notes-list');
  if (!list) return;
  if (notes.length === 0) {
    list.innerHTML = '<div style="color:#888;">暂无便签</div>';
    return;
  }
  list.innerHTML = notes.map(note =>
    `<div style="margin-bottom:8px;padding:8px 12px;background:#f8f8f8;border-radius:6px;min-width:160px;display:flex;align-items:center;">
      <span style="flex:1;white-space:pre-line;">${note.content.replace(/</g,'&lt;')}</span>
      <button data-id="${note.id}" class="delete-note-btn" style="margin-left:8px;">删除</button>
    </div>`
  ).join('');
  // 绑定删除
  list.querySelectorAll('.delete-note-btn').forEach(btn => {
    btn.onclick = function() {
      const id = btn.getAttribute('data-id');
      const notes = getNotes().filter(n => n.id !== id);
      saveNotes(notes);
      renderNotesList();
    };
  });
}

window.addEventListener('DOMContentLoaded', function() {
  const btn = document.getElementById('floaty-btn');
  if (!('documentPictureInPicture' in window)) {
    alert('当前浏览器不支持全局悬浮便签');
    btn.disabled = true;
    return;
  }
  const note = document.getElementById('floaty-note');
  const textarea = note ? note.querySelector('textarea') : null;
  const newBtn = document.getElementById('new-note-btn');

  renderNotesList();

  // 新建便签
  if (newBtn) {
    newBtn.onclick = function() {
      openFloatyNote('');
    };
  }

  const COLORS = [
    '#fff', '#fffbe6', '#fff0f6', '#e6f7ff'
  ];

  function getNoteData() {
    return {
      content: localStorage.getItem('floaty_note_content') || '',
      color: localStorage.getItem('floaty_note_color') || COLORS[0]
    };
  }
  function saveNoteData(content, color) {
    localStorage.setItem('floaty_note_content', content);
    localStorage.setItem('floaty_note_color', color);
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'floaty_note_content', newValue: content
    }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'floaty_note_color', newValue: color
    }));
  }

  window.addEventListener('storage', function(e) {
    if (e.key === 'floaty_note_content' || e.key === 'floaty_note_color') {
      updateNotesList();
    }
  });

  function updateNotesList() {
    const list = document.getElementById('notes-list');
    if (list) {
      const { content, color } = getNoteData();
      list.innerHTML = `<div style="background:${color};padding:12px 16px;border-radius:8px;min-width:160px;word-break:break-all;">${content || '暂无便签'}</div>`;
    }
  }
  updateNotesList();

  // 主页面弹窗初始化 Quill
  let quill;
  function showInlineNote() {
    let note = document.getElementById('floaty-note');
    if (!note) return;
    const { content, color } = getNoteData();
    note.style.display = 'block';
    note.style.background = color;
    // textarea 替换 Quill
    let textarea = document.getElementById('plain-editor');
    textarea.value = content;
    textarea.style.background = color;
    textarea.style.width = '100%';
    textarea.style.height = '100%';
    textarea.style.boxSizing = 'border-box';
    textarea.focus();
    // 颜色选择区
    const COLORS = [
      '#fff', '#fffbe6', '#fff0f6', '#e6f7ff'
    ];
    let colorPicker = document.getElementById('color-picker');
    if (colorPicker) {
      colorPicker.innerHTML = '';
      COLORS.forEach(c => {
        const colorDot = document.createElement('span');
        colorDot.style = `width:22px;height:22px;border-radius:50%;border:2px solid #ccc;display:inline-block;cursor:pointer;background:${c};box-shadow:0 1px 4px #0001;`;
        if ((textarea.style.background||color) === c) colorDot.style.border = '2px solid #333';
        colorDot.onclick = function() {
          textarea.style.background = c;
          saveNoteData(textarea.value, c);
          colorPicker.querySelectorAll('span').forEach(dot => dot.style.border = '2px solid #ccc');
          colorDot.style.border = '2px solid #333';
        };
        colorPicker.appendChild(colorDot);
      });
    }
    // 保存按钮
    let saveBtn = document.getElementById('save-note-btn');
    if (saveBtn) {
      saveBtn.onclick = function() {
        saveNoteData(textarea.value, textarea.style.background || color);
      };
    }
    // textarea输入时自动保存
    textarea.oninput = function() {
      saveNoteData(textarea.value, textarea.style.background || color);
    };
  }

  btn.onclick = async function() {
    try {
      const pipWin = await documentPictureInPicture.requestWindow();
      try { pipWin.resizeTo(200, 150); } catch(e){} // 兼容性处理
      const doc = pipWin.document;
      doc.documentElement.style.height = '100%';
      doc.body.style.height = '100%';
      doc.body.style.margin = '0';
      doc.body.style.padding = '0';
      doc.body.style.border = 'none';
      doc.body.style.boxSizing = 'border-box';
      const COLORS = [
        '#fff', '#fffbe6', '#fff0f6', '#e6f7ff'
      ];
      const content = localStorage.getItem('floaty_note_content') || '';
      const color = localStorage.getItem('floaty_note_color') || COLORS[0];
      // 创建 textarea
      const textarea = doc.createElement('textarea');
      textarea.style = 'width:100%;margin:0;padding:12px 8px 8px 8px;border:none;box-sizing:border-box;resize:none;outline:none;font-size:13px;display:block;';
      textarea.value = content;
      textarea.placeholder = '请输入标签内容，下拉可切换颜色';
      textarea.autofocus = true;
      textarea.oninput = function() {
        localStorage.setItem('floaty_note_content', textarea.value);
      };
      doc.body.appendChild(textarea);
      // 颜色选择区和保存按钮
      const btnRow = doc.createElement('div');
      btnRow.style = 'display:flex;align-items:center;justify-content:center;gap:16px;min-height:32px;box-sizing:border-box;width:100%;margin:0 0 8px 0;padding:0;border:none;';
      const colorWrap = doc.createElement('div');
      colorWrap.style = 'display:flex;justify-content:center;gap:16px;align-items:center;margin-top:8px;margin-bottom:8px;width:100%';
      const colorNames = ['白色','淡黄','粉红','淡蓝'];
      COLORS.forEach((c,idx) => {
        const colorDot = doc.createElement('span');
        colorDot.style = `width:20px;height:20px;border-radius:50%;border:2px solid #ccc;display:inline-block;cursor:pointer;background:${c};box-shadow:0 1px 4px #0001;margin:0;transition:box-shadow 0.2s,transform 0.2s,border 0.2s;`;
        colorDot.title = colorNames[idx] || '';
        if ((textarea.style.background||color) === c) {
          colorDot.style.border = '2.5px solid #333';
          colorDot.style.boxShadow = '0 0 0 4px rgba(165,201,202,0.15)';
          colorDot.style.transform = 'scale(1.15)';
        }
        colorDot.onmouseover = function(){ colorDot.style.transform = 'scale(1.10)'; };
        colorDot.onmouseout = function(){
          if ((textarea.style.background||color) === c) {
            colorDot.style.transform = 'scale(1.15)';
          } else {
            colorDot.style.transform = 'scale(1)';
          }
        };
        colorDot.onclick = function() {
          textarea.style.background = c;
          localStorage.setItem('floaty_note_color', c);
          colorWrap.querySelectorAll('span').forEach(dot => {
            dot.style.border = '2px solid #ccc';
            dot.style.boxShadow = '0 1px 4px #0001';
            dot.style.transform = 'scale(1)';
          });
          colorDot.style.border = '2.5px solid #333';
          colorDot.style.boxShadow = '0 0 0 4px rgba(165,201,202,0.15)';
          colorDot.style.transform = 'scale(1.15)';
        };
        colorWrap.appendChild(colorDot);
      });
      btnRow.appendChild(colorWrap);
      doc.body.appendChild(btnRow);
      // 动态分配高度和限制最小宽高
      function layout() {
        const winH = Math.max(pipWin.innerHeight, 150);
        const winW = Math.max(pipWin.innerWidth, 160);
        textarea.style.height = Math.floor(winH * 0.85) + 'px';
        btnRow.style.height = Math.ceil(winH * 0.15) + 'px';
        doc.body.style.minWidth = '160px';
        doc.body.style.minHeight = '150px';
      }
      layout();
      pipWin.addEventListener('resize', layout);
      // 去除滚动条
      const style = doc.createElement('style');
      style.textContent = 'html,body{overflow:hidden;} textarea::-webkit-scrollbar{display:none;} textarea{overflow:hidden;}';
      doc.head.appendChild(style);
    } catch (e) {
      alert('全局悬浮失败：' + e.message);
    }
  };

  // 便签弹窗保存逻辑
  if (note && textarea) {
    // 输入时自动保存
    textarea.oninput = function() {
      const val = textarea.value;
      if (val.trim()) {
        let notes = getNotes();
        if (!note._editingId) {
          // 新建时，实时保存为一条新便签（只保存一次）
          if (!note._createdId) {
            const id = uuid();
            notes.unshift({ id, content: val, time: Date.now() });
            note._createdId = id;
            note._editingId = id;
          } else {
            notes = notes.map(n => n.id === note._createdId ? { ...n, content: val, time: Date.now() } : n);
          }
        } else {
          notes = notes.map(n => n.id === note._editingId ? { ...n, content: val, time: Date.now() } : n);
        }
        saveNotes(notes);
        renderNotesList();
      }
    };
    // 失焦时清理编辑状态
    textarea.onblur = function() {
      note._editingId = null;
      note._createdId = null;
    };
  }

  // 列表点击可编辑
  document.getElementById('notes-list').onclick = function(e) {
    const target = e.target;
    if (target.tagName === 'SPAN' && target.parentNode) {
      const id = target.parentNode.querySelector('.delete-note-btn')?.getAttribute('data-id');
      if (id) {
        const noteObj = getNotes().find(n => n.id === id);
        if (noteObj) openFloatyNote(noteObj.content, id);
      }
    }
  };

  // 弹出全局悬浮便签
  function openFloatyNote(content, editingId) {
    if (!note || !textarea) return;
    textarea.value = content || '';
    note._editingId = editingId || null;
    note._createdId = null;
    if ('documentPictureInPicture' in window) {
      note.style.display = 'block';
      documentPictureInPicture.requestWindow(note).catch(() => {
        note.style.display = 'block';
      });
    } else {
      note.style.display = 'block';
    }
    textarea.focus();
  }

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
}); 