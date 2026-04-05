// Firebase Auth - Fixed for CDN (no import/export browser compatibility)
window.firebaseConfig = {
  apiKey: "AIzaSyCQq87lw_E8K7vJn1ZCpg73QqdboImj3tg",
  authDomain: "hackathon-ai-4f6f4.firebaseapp.com",
  projectId: "hackathon-ai-4f6f4",
  storageBucket: "hackathon-ai-4f6f4.firebasestorage.app",
  messagingSenderId: "955226965508",
  appId: "1:955226965508:web:a34cdf8b588af360c6d751"
};

// Wait for Firebase CDN, then initialize
function initFirebaseAuth() {
  if (typeof firebase === 'undefined') {
    setTimeout(initFirebaseAuth, 100);
    return;
  }
  
  const app = firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  
  window.FlowAuth = {
    currentUser: null,
    onAuthChange: (callback) => {
      return auth.onAuthStateChanged((user) => {
        window.FlowAuth.currentUser = user;
        callback(user);
      });
    },
    login: (email, password) => auth.signInWithEmailAndPassword(email, password),
    register: (email, password) => auth.createUserWithEmailAndPassword(email, password),
    logout: () => auth.signOut(),
    googleLogin: () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      return auth.signInWithPopup(provider);
    },
    isAuthenticated: () => !!window.FlowAuth.currentUser,
    getCurrentUser: () => window.FlowAuth.currentUser
  };
  
  console.log('Firebase Auth v9 initialized (CDN)');
}

initFirebaseAuth();


