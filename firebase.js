// firebase.js
let authStateListener = (callback) => { callback(null); };
let db = null;

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
          
          // 将用户信息存储在sessionStorage中
          sessionStorage.setItem('currentUser', JSON.stringify(userInfo));
          
          // 登录后自动同步本地便签到云端
          syncNotesToCloud(user.uid);
        } else {
          console.log('Firebase 检测到用户未登录');
          // 清除sessionStorage中的用户信息
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
          return;
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
                return;
              }
              
              notesData = {
                notes: notes,
                updatedAt: serverTimestamp()
              };
            } catch (error) {
              console.error('解析本地便签列表失败:', error);
              return;
            }
          } else {
            // 使用单便签模式
            notesData = {
              content: noteContent,
              color: noteColor,
              updatedAt: serverTimestamp()
            };
          }
        }
        
        // 保存到云端
        const userNotesRef = doc(db, 'user_notes', userId);
        const userDoc = await getDoc(userNotesRef);
        
        if (userDoc.exists()) {
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
        
        return true;
      } catch (error) {
        console.error('同步便签到云端失败:', error);
        return false;
      }
    }
    
    // 从云端加载便签内容
    async function loadNotesFromCloud(userId) {
      try {
        console.log('正在从云端加载便签...');
        
        if (!userId) {
          console.error('加载便签失败: 没有用户ID');
          return null;
        }
        
        const userNotesRef = doc(db, 'user_notes', userId);
        const userDoc = await getDoc(userNotesRef);
        
        if (userDoc.exists()) {
          const noteData = userDoc.data();
          console.log('从云端获取到便签数据:', noteData);
          
          // 检查是否是新格式（包含notes数组）
          if (noteData.notes) {
            return {
              notes: noteData.notes,
              updatedAt: noteData.updatedAt ? noteData.updatedAt.toDate().getTime() : Date.now()
            };
          } 
          // 旧格式（单便签）
          else if (noteData.content) {
            // 转换为新格式
            const note = {
              id: 'legacy-note',
              content: noteData.content,
              color: noteData.color || '#fffbe6',
              createdAt: noteData.createdAt ? noteData.createdAt.toDate().getTime() : Date.now(),
              updatedAt: noteData.updatedAt ? noteData.updatedAt.toDate().getTime() : Date.now()
            };
            
            return {
              notes: [note],
              updatedAt: note.updatedAt
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
        console.error('从云端加载便签失败:', error);
        return null;
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