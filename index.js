// 首页所有原内联JS迁移至此

// 悬浮按钮交互与服务注册
const btn = document.getElementById('floaty-btn');
if (btn) {
  btn.onmouseover = function(){btn.style.filter='brightness(1.12)';btn.style.boxShadow='0 8px 32px rgba(45,55,72,0.28)';};
  btn.onmouseout = function(){btn.style.filter='none';btn.style.boxShadow='0 6px 24px rgba(45,55,72,0.18)';};
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}
// 检查URL参数，自动弹出悬浮便签
if (location.search.includes('autoFloaty=1')) {
  window.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('floaty-btn');
    if (btn) btn.click();
  });
}

// 底部新建便签按钮
function setupMobileNewNoteBtn() {
  const mobileBtn = document.getElementById('mobile-new-note-btn');
  if (!mobileBtn) return;
  
  // 始终显示底部按钮
  mobileBtn.style.display = 'block';
  
  // 绑定点击事件
  const btnElement = mobileBtn.querySelector('button');
  if (btnElement) {
    btnElement.onclick = function() {
      console.log('底部新建便签按钮被点击');
      
      // 优先使用画中画窗口（全局悬浮便签）
      if ('documentPictureInPicture' in window && window.openFloatyNote) {
        console.log('使用画中画窗口创建便签');
        window.openFloatyNote('');
        return;
      }
      
      // 如果不支持画中画，检查内联便签容器是否存在
      const floatyNote = document.getElementById('floaty-note');
      if (!floatyNote) {
        console.error('内联便签容器不存在，无法创建内联便签');
        alert('创建便签失败：缺少必要的DOM元素');
        return;
      }
      
      // 使用内联便签
      if (window.showInlineNote) {
        console.log('使用内联便签');
        window.showInlineNote('');
      } else {
        console.error('无法找到创建便签的函数');
        alert('创建便签失败：无法找到创建函数');
      }
    };
  }
}

// 响应式显示移动端元素
function checkMobileView() {
  // 移动端联系按钮
  const mobileContact = document.getElementById('mobile-contact');
  if (mobileContact) {
    if (window.innerWidth < 768) {
      mobileContact.style.display = 'block';
    } else {
      mobileContact.style.display = 'none';
    }
  }
  
  // 移动端底部新建便签按钮
  setupMobileNewNoteBtn();
}

window.addEventListener('load', checkMobileView);
window.addEventListener('resize', checkMobileView);

// 主便签内容说明与同步
(function() {
  var defaultNote = "便签\n\n1. 点击上方按钮创建全局悬浮便签\n2. 输入内容自动保存，支持多种颜色切换\n3. 所有数据仅保存在本地浏览器，安全私密\n4. 支持离线使用，体验更佳";
  var defaultColor = "#fffbe6";
  function updateMainNote() {
    var note = localStorage.getItem('floaty_note_content');
    var color = localStorage.getItem('floaty_note_color') || defaultColor;
    var mainNote = document.getElementById('main-note');
    if (!mainNote) return;
    if (note === null || !note.trim()) {
      mainNote.textContent = defaultNote;
      mainNote.style.background = defaultColor;
    } else {
      mainNote.textContent = note;
      mainNote.style.background = color;
    }
    mainNote.style.height = 'auto';
    if (mainNote.scrollHeight > 500) {
      mainNote.style.maxHeight = '500px';
      mainNote.style.overflowY = 'auto';
    } else {
      mainNote.style.maxHeight = 'none';
      mainNote.style.overflowY = 'visible';
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateMainNote);
  } else {
    updateMainNote();
  }
  window.addEventListener('storage', function(e) {
    if (e.key === 'floaty_note_content' || e.key === 'floaty_note_color') updateMainNote();
  });
  setInterval(updateMainNote, 1000);
})();

// 用户便签内容同步
(function() {
  var defaultColor = "#fffbe6";
  function updateUserNote() {
    var note = localStorage.getItem('floaty_new_note_content');
    var color = localStorage.getItem('floaty_new_note_color') || defaultColor;
    if (!note || !note.trim()) {
      note = localStorage.getItem('floaty_note_content');
      color = localStorage.getItem('floaty_note_color') || defaultColor;
    }
    var userNote = document.getElementById('user-note');
    if (!userNote) return;
    if (note && note.trim()) {
      userNote.textContent = note;
      userNote.style.background = color;
      userNote.style.display = 'block';
      userNote.style.height = 'auto';
      if (userNote.scrollHeight > 500) {
        userNote.style.maxHeight = '500px';
        userNote.style.overflowY = 'auto';
      } else {
        userNote.style.maxHeight = 'none';
        userNote.style.overflowY = 'visible';
      }
    } else {
      userNote.style.display = 'none';
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateUserNote);
  } else {
    updateUserNote();
  }
  window.addEventListener('storage', function(e) {
    if (e.key === 'floaty_note_content' || e.key === 'floaty_note_color' || 
      e.key === 'floaty_new_note_content' || e.key === 'floaty_new_note_color' ||
      e.key === 'floaty_notes') {
      updateUserNote();
    }
  });
  setInterval(updateUserNote, 1000);
})();
