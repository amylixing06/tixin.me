// firebase.js
let authStateListener = (callback) => { callback(null); };
let db = null;
// 添加同步状态追踪
let syncAttempts = 0;
const MAX_SYNC_ATTEMPTS = 3;

// 检查localStorage中是否有用户信息，优先使用localStorage确保跨会话持久化
const localUser = localStorage.getItem('currentUser');
if (localUser) {
  try {
    const userInfo = JSON.parse(localUser);
    console.log('Firebase初始化前从localStorage恢复用户信息:', userInfo);
    // 同步到sessionStorage
    sessionStorage.setItem('currentUser', localUser);
    // 立即执行回调，不等待Firebase初始化
    setTimeout(() => {
      if (typeof callback === 'function') {
        callback(userInfo);
      }
    }, 0);
  } catch (e) {
    console.error('解析localStorage中的用户信息失败:', e);
  }
} 
// 如果localStorage中没有，再检查sessionStorage
else {
  const storedUser = sessionStorage.getItem('currentUser');
  if (storedUser) {
    try {
      const userInfo = JSON.parse(storedUser);
      console.log('Firebase初始化前从sessionStorage恢复用户信息:', userInfo);
      // 同步到localStorage以确保持久化
      localStorage.setItem('currentUser', storedUser);
      // 立即执行回调，不等待Firebase初始化
      setTimeout(() => {
        if (typeof callback === 'function') {
          callback(userInfo);
        }
      }, 0);
    } catch (e) {
      console.error('解析sessionStorage中的用户信息失败:', e);
    }
  }
}

try {
  // 动态导入 Firebase SDK
  Promise.all([
    import("https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js")
  ]).then(([firebaseApp, firebaseAuth, firebaseFirestore]) => {
    const { initializeApp } = firebaseApp;
    const { 
      getAuth, 
      createUserWithEmailAndPassword, 
      signInWithEmailAndPassword, 
      onAuthStateChanged, 
      signOut, 
      signInWithPopup, 
      GoogleAuthProvider,
      setPersistence,
      browserLocalPersistence
    } = firebaseAuth;
    
    const {
      getFirestore,
      collection,
      doc,
      setDoc,
      getDoc,
      updateDoc,
      deleteDoc,
      onSnapshot,
      serverTimestamp,
      query,
      where,
      orderBy,
      limit
    } = firebaseFirestore;

    // Your web app's Firebase configuration
    const firebaseConfig = {
      apiKey: "AIzaSyAJdMFDtKJN41X7uSl7ITTBlc4HTX2PCoY",
      authDomain: "tixinme.firebaseapp.com",
      projectId: "tixinme",
      storageBucket: "tixinme.firebasestorage.app",
      messagingSenderId: "855064719131",
      appId: "1:855064719131:web:74555a32a200f8b1f2edbe"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    db = getFirestore(app);
    
    // 设置认证持久化，使用本地存储
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log('Firebase 认证持久化设置成功');
      })
      .catch((error) => {
        console.error('Firebase 认证持久化设置失败:', error);
      });

    // 重新定义认证相关函数
    authStateListener = (callback) => {
      // 先检查localStorage中是否有用户信息
      const localUser = localStorage.getItem('currentUser');
      if (localUser) {
        try {
          const userInfo = JSON.parse(localUser);
          console.log('从localStorage恢复用户信息:', userInfo);
          // 同步到sessionStorage
          sessionStorage.setItem('currentUser', localUser);
          // 立即执行回调，不等待Firebase初始化
          setTimeout(() => {
            callback(userInfo);
          }, 0);
        } catch (e) {
          console.error('解析localStorage中的用户信息失败:', e);
        }
      } 
      // 如果localStorage中没有，再检查sessionStorage
      else {
        const storedUser = sessionStorage.getItem('currentUser');
        if (storedUser) {
          try {
            const userInfo = JSON.parse(storedUser);
            console.log('从sessionStorage恢复用户信息:', userInfo);
            // 立即执行回调，不等待Firebase初始化
            setTimeout(() => {
              callback(userInfo);
            }, 0);
          } catch (e) {
            console.error('解析sessionStorage中的用户信息失败:', e);
          }
        }
      }
      
      // 然后设置Firebase的状态监听
      return onAuthStateChanged(auth, user => {
        // 确保回调函数在用户状态变化时被调用
        if (user) {
          console.log('Firebase 检测到用户已登录:', user.email);
          
          // 获取用户信息，包括头像
          const userInfo = {
            email: user.email,
            uid: user.uid,
            displayName: user.displayName || '',
            photoURL: user.photoURL || ''
          };
          
          console.log('用户信息:', userInfo);
          
          // 将用户信息存储在localStorage和sessionStorage中
          const userInfoStr = JSON.stringify(userInfo);
          localStorage.setItem('currentUser', userInfoStr);
          sessionStorage.setItem('currentUser', userInfoStr);
          
          // 登录后自动同步本地便签到云端
          syncNotesToCloud(user.uid);
        } else {
          console.log('Firebase 检测到用户未登录');
          // 清除localStorage和sessionStorage中的用户信息
          localStorage.removeItem('currentUser');
          sessionStorage.removeItem('currentUser');
        }
        callback(user);
      });
    };
    
    // 同步本地便签到云端
    async function syncNotesToCloud(userId, notesData) {
      try {
        console.log('开始同步便签到云端...');
        
        if (!userId) {
          console.error('同步便签失败: 没有用户ID');
          return { success: false, error: '没有用户ID' };
        }
        
        if (!db) {
          console.error('同步便签失败: 数据库未初始化');
          return { success: false, error: '数据库未初始化' };
        }
        
        // 如果没有提供notesData，则从localStorage获取
        if (!notesData) {
          // 获取本地便签内容
          const noteContent = localStorage.getItem('floaty_note_content') || '';
          const noteColor = localStorage.getItem('floaty_note_color') || '#fffbe6';
          
          // 检查是否有内容需要同步
          if (!noteContent.trim()) {
            console.log('本地没有便签内容，尝试同步便签列表');
            
            try {
              // 尝试获取便签列表
              const notes = JSON.parse(localStorage.getItem('floaty_notes') || '[]');
              if (notes.length === 0) {
                console.log('本地没有便签列表，跳过同步');
                return { success: true, message: '没有数据需要同步' };
              }
              
              notesData = {
                notes: notes,
                updatedAt: serverTimestamp(),
                deviceId: localStorage.getItem('device_id') || 'unknown-device',
                syncVersion: parseInt(localStorage.getItem('last_sync_version') || '0') + 1
              };
            } catch (error) {
              console.error('解析本地便签列表失败:', error);
              return { success: false, error: '解析本地便签列表失败' };
            }
          } else {
            // 使用单便签模式
            notesData = {
              content: noteContent,
              color: noteColor,
              updatedAt: serverTimestamp(),
              deviceId: localStorage.getItem('device_id') || 'unknown-device',
              syncVersion: parseInt(localStorage.getItem('last_sync_version') || '0') + 1
            };
          }
        }
        
        // 添加网络状态检查
        if (!navigator.onLine) {
          console.error('同步便签失败: 网络连接已断开');
          return { success: false, error: '网络连接已断开', offline: true };
        }
        
        // 保存到云端
        const userNotesRef = doc(db, 'user_notes', userId);
        
        try {
          const userDoc = await getDoc(userNotesRef);
          
          // 检查是否存在冲突
          if (userDoc.exists()) {
            const cloudData = userDoc.data();
            
            // 检查设备ID和同步版本
            if (cloudData.deviceId && 
                cloudData.deviceId !== notesData.deviceId && 
                cloudData.syncVersion >= notesData.syncVersion) {
              
              console.warn('检测到潜在冲突，云端数据可能更新');
              
              // 获取云端更新时间
              const cloudUpdatedAt = cloudData.updatedAt ? 
                (typeof cloudData.updatedAt.toDate === 'function' ? 
                  cloudData.updatedAt.toDate().getTime() : cloudData.updatedAt) : 0;
              
              // 获取本地上次同步时间
              const lastSyncTimestamp = parseInt(localStorage.getItem('last_sync_timestamp') || '0');
              
              // 如果云端数据比本地上次同步更新，则可能存在冲突
              if (cloudUpdatedAt > lastSyncTimestamp) {
                console.warn('检测到数据冲突，需要先合并数据');
                return { 
                  success: false, 
                  error: '检测到数据冲突，需要先合并数据', 
                  conflict: true 
                };
              }
            }
            
            // 更新现有文档
            await updateDoc(userNotesRef, notesData);
            console.log('便签内容已更新到云端');
          } else {
            // 创建新文档
            await setDoc(userNotesRef, {
              ...notesData,
              createdAt: serverTimestamp()
            });
            console.log('便签内容已保存到云端');
          }
          
          // 重置同步尝试计数
          syncAttempts = 0;
          
          return { success: true };
        } catch (error) {
          console.error('同步便签到云端失败:', error);
          
          // 增加重试计数
          syncAttempts++;
          
          // 如果未超过最大重试次数，返回特殊错误码
          if (syncAttempts < MAX_SYNC_ATTEMPTS) {
            return { 
              success: false, 
              error: error.message, 
              shouldRetry: true,
              attempt: syncAttempts
            };
          }
          
          return { success: false, error: error.message };
        }
      } catch (error) {
        console.error('同步便签到云端过程中发生错误:', error);
        return { success: false, error: error.message };
      }
    }
    
    // 从云端加载便签内容
    async function loadNotesFromCloud(userId, syncOptions = {}) {
      try {
        console.log('正在从云端加载便签...', syncOptions);
        
        if (!userId) {
          console.error('加载便签失败: 没有用户ID');
          return null;
        }
        
        if (!db) {
          console.error('加载便签失败: 数据库未初始化');
          return null;
        }
        
        // 添加网络状态检查
        if (!navigator.onLine) {
          console.error('加载便签失败: 网络连接已断开');
          throw new Error('网络连接已断开');
        }
        
        const userNotesRef = doc(db, 'user_notes', userId);
        
        try {
          const userDoc = await getDoc(userNotesRef);
          
          if (userDoc.exists()) {
            const noteData = userDoc.data();
            console.log('从云端获取到便签数据:', noteData);
            
            // 检查是否是增量同步
            if (syncOptions.lastSyncTimestamp && syncOptions.deviceId) {
              const lastSyncTimestamp = parseInt(syncOptions.lastSyncTimestamp);
              const cloudUpdatedAt = noteData.updatedAt ? 
                (typeof noteData.updatedAt.toDate === 'function' ? noteData.updatedAt.toDate().getTime() : noteData.updatedAt) : 0;
              
              // 如果云端数据没有更新，且不是来自当前设备的更新，则返回无变化
              if (cloudUpdatedAt <= lastSyncTimestamp && 
                  noteData.deviceId !== syncOptions.deviceId && 
                  noteData.syncVersion <= parseInt(syncOptions.lastSyncVersion || '0')) {
                console.log('云端数据没有变化，跳过同步');
                return { noChanges: true };
              }
            }
            
            // 检查是否是新格式（包含notes数组）
            if (noteData.notes) {
              // 确保处理notes数组中的时间戳
              const processedNotes = noteData.notes.map(note => {
                // 确保updatedAt和createdAt是数字时间戳
                if (note.updatedAt && typeof note.updatedAt.toDate === 'function') {
                  note.updatedAt = note.updatedAt.toDate().getTime();
                }
                if (note.createdAt && typeof note.createdAt.toDate === 'function') {
                  note.createdAt = note.createdAt.toDate().getTime();
                }
                return note;
              });
              
              // 检查是否有冲突（如果是增量同步）
              let hasConflicts = false;
              if (syncOptions.lastSyncTimestamp) {
                // 如果云端设备ID与当前设备不同，且有更新，可能存在冲突
                hasConflicts = noteData.deviceId !== syncOptions.deviceId && 
                               noteData.syncVersion !== parseInt(syncOptions.lastSyncVersion || '0');
              }
              
              return {
                notes: processedNotes,
                updatedAt: noteData.updatedAt ? 
                  (typeof noteData.updatedAt.toDate === 'function' ? noteData.updatedAt.toDate().getTime() : noteData.updatedAt) : 
                  Date.now(),
                syncVersion: noteData.syncVersion || 1,
                deviceId: noteData.deviceId,
                hasConflicts
              };
            } 
            // 旧格式（单便签）
            else if (noteData.content) {
              // 转换为新格式
              const note = {
                id: 'legacy-note',
                content: noteData.content,
                color: noteData.color || '#fffbe6',
                createdAt: noteData.createdAt ? 
                  (typeof noteData.createdAt.toDate === 'function' ? noteData.createdAt.toDate().getTime() : noteData.createdAt) : 
                  Date.now(),
                updatedAt: noteData.updatedAt ? 
                  (typeof noteData.updatedAt.toDate === 'function' ? noteData.updatedAt.toDate().getTime() : noteData.updatedAt) : 
                  Date.now()
              };
              
              return {
                notes: [note],
                updatedAt: note.updatedAt,
                syncVersion: 1
              };
            } else {
              console.log('云端便签数据格式不正确');
              return null;
            }
          } else {
            console.log('云端没有便签数据');
            return null;
          }
        } catch (error) {
          console.error('从云端获取便签数据失败:', error);
          throw error;
        }
      } catch (error) {
        console.error('从云端加载便签失败:', error);
        throw error;
      }
    }
    
    // 实时监听云端便签变化
    function watchCloudNotes(userId, callback) {
      if (!userId) return null;
      
      const userNotesRef = doc(db, 'user_notes', userId);
      return onSnapshot(userNotesRef, (doc) => {
        if (doc.exists()) {
          const noteData = doc.data();
          console.log('云端便签数据变化:', noteData);
          callback(noteData);
        }
      }, (error) => {
        console.error('监听云端便签变化失败:', error);
      });
    }

    // 导出认证相关函数
    window.firebaseAuth = {
      createUser: (email, password) => {
        return createUserWithEmailAndPassword(auth, email, password);
      },
      signIn: (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
      },
      logOut: () => {
        sessionStorage.removeItem('currentUser');
        localStorage.removeItem('currentUser');
        return signOut(auth);
      },
      authStateListener,
      auth,
      signInWithPopup,
      GoogleAuthProvider
    };
    
    // 导出数据库相关函数
    window.firebaseDB = {
      syncNotesToCloud,
      loadNotesFromCloud,
      watchCloudNotes,
      serverTimestamp: () => serverTimestamp()
    };

    console.log('Firebase 初始化成功');
    
    // 检查当前用户状态
    const currentUser = auth.currentUser;
    if (currentUser) {
      console.log('当前已登录用户:', currentUser.email);
      if (currentUser.photoURL) {
        console.log('用户头像URL:', currentUser.photoURL);
      }
      
      // 自动同步便签
      syncNotesToCloud(currentUser.uid);
    } else {
      console.log('当前没有登录用户');
      
      // 尝试从localStorage恢复用户信息
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        try {
          const userInfo = JSON.parse(storedUser);
          console.log('从localStorage恢复用户信息:', userInfo);
          sessionStorage.setItem('currentUser', JSON.stringify(userInfo));
        } catch (e) {
          console.error('解析localStorage中的用户信息失败:', e);
        }
      }
    }
  }).catch(err => {
    console.error('Firebase 初始化失败:', err);
  });
} catch (err) {
  console.error('导入 Firebase SDK 时出错:', err);
}

// 导出认证相关函数
export { authStateListener };
export default { authStateListener }; 