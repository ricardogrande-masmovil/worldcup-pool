import React, { useState, useEffect } from "react";
import { 
  auth, db 
} from "./firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  writeBatch 
} from "firebase/firestore";
import { initialMatches } from "./data/initialMatches";
import confetti from "canvas-confetti";
import { 
  Trophy, Users, Shield, LogOut, Mail, Lock, User, 
  Calendar, Save, CheckCircle2, AlertCircle, RefreshCw, 
  Eye, Check, ListFilter, Star, Share2, ChevronUp
} from "lucide-react";

const knockoutSources = {
  match_89: { home: "match_74", away: "match_77" },
  match_90: { home: "match_73", away: "match_75" },
  match_91: { home: "match_76", away: "match_78" },
  match_92: { home: "match_79", away: "match_80" },
  match_93: { home: "match_83", away: "match_84" },
  match_94: { home: "match_81", away: "match_82" },
  match_95: { home: "match_86", away: "match_88" },
  match_96: { home: "match_85", away: "match_87" },
  match_97: { home: "match_89", away: "match_90" },
  match_98: { home: "match_93", away: "match_94" },
  match_99: { home: "match_91", away: "match_92" },
  match_100: { home: "match_95", away: "match_96" },
  match_101: { home: "match_97", away: "match_98" },
  match_102: { home: "match_99", away: "match_100" },
  match_103: { home: "match_101", away: "match_102", type: "loser" },
  match_104: { home: "match_101", away: "match_102", type: "winner" }
};

function calculateStandings(matches, predictions) {
  const groupTeams = {};
  
  // Populate groups and teams
  matches.forEach(match => {
    if (match.stage.startsWith("Fase de Grupos - Grupo ")) {
      const groupLetter = match.stage.slice(-1);
      if (!groupTeams[groupLetter]) {
        groupTeams[groupLetter] = {};
      }
      if (match.homeTeam && !match.homeTeam.startsWith("1º") && !match.homeTeam.startsWith("2º")) {
        if (!groupTeams[groupLetter][match.homeTeam]) {
          groupTeams[groupLetter][match.homeTeam] = { team: match.homeTeam, points: 0, gd: 0, gf: 0, played: 0 };
        }
      }
      if (match.awayTeam && !match.awayTeam.startsWith("1º") && !match.awayTeam.startsWith("2º")) {
        if (!groupTeams[groupLetter][match.awayTeam]) {
          groupTeams[groupLetter][match.awayTeam] = { team: match.awayTeam, points: 0, gd: 0, gf: 0, played: 0 };
        }
      }
    }
  });
  
  // Update stats based on predictions
  matches.forEach(match => {
    if (match.stage.startsWith("Fase de Grupos - Grupo ")) {
      const groupLetter = match.stage.slice(-1);
      const pred = predictions[match.id];
      if (pred && pred.homeScore !== undefined && pred.homeScore !== "" && pred.awayScore !== undefined && pred.awayScore !== "") {
        const homeScore = parseInt(pred.homeScore);
        const awayScore = parseInt(pred.awayScore);
        
        const homeStats = groupTeams[groupLetter][match.homeTeam];
        const awayStats = groupTeams[groupLetter][match.awayTeam];
        
        if (homeStats && awayStats) {
          homeStats.played += 1;
          awayStats.played += 1;
          homeStats.gf += homeScore;
          awayStats.gf += awayScore;
          homeStats.gd += (homeScore - awayScore);
          awayStats.gd += (awayScore - homeScore);
          
          if (homeScore > awayScore) {
            homeStats.points += 3;
          } else if (homeScore < awayScore) {
            awayStats.points += 3;
          } else {
            homeStats.points += 1;
            awayStats.points += 1;
          }
        }
      }
    }
  });
  
  const standings = {};
  Object.keys(groupTeams).forEach(groupLetter => {
    const teamsList = Object.values(groupTeams[groupLetter]);
    teamsList.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.localeCompare(b.team);
    });
    standings[groupLetter] = teamsList;
  });
  
  return standings;
}

function allocateThirdPlaces(qualifiedThirds) {
  const slots = [
    { matchId: "match_74", allowed: ["A", "B", "C", "D", "F"] },
    { matchId: "match_77", allowed: ["C", "D", "F", "G", "H"] },
    { matchId: "match_79", allowed: ["C", "E", "F", "H", "I"] },
    { matchId: "match_80", allowed: ["E", "H", "I", "J", "K"] },
    { matchId: "match_81", allowed: ["B", "E", "F", "I", "J"] },
    { matchId: "match_82", allowed: ["A", "E", "H", "I", "J"] },
    { matchId: "match_85", allowed: ["E", "F", "G", "I", "J"] },
    { matchId: "match_87", allowed: ["D", "E", "I", "J", "L"] }
  ];
  
  const assignment = {};
  const assignedTeams = new Set();
  
  function backtrack(slotIndex) {
    if (slotIndex === slots.length) return true;
    const slot = slots[slotIndex];
    for (let i = 0; i < qualifiedThirds.length; i++) {
      const teamObj = qualifiedThirds[i];
      if (!assignedTeams.has(teamObj.team) && slot.allowed.includes(teamObj.group)) {
        assignedTeams.add(teamObj.team);
        assignment[slot.matchId] = teamObj.team;
        if (backtrack(slotIndex + 1)) return true;
        assignedTeams.delete(teamObj.team);
        delete assignment[slot.matchId];
      }
    }
    return false;
  }
  
  if (!backtrack(0)) {
    const available = [...qualifiedThirds];
    slots.forEach(slot => {
      const match = available.find(t => !assignedTeams.has(t.team)) || available[0];
      if (match) {
        assignedTeams.add(match.team);
        assignment[slot.matchId] = match.team;
      }
    });
  }
  
  return assignment;
}

function getMatchOutcome(matchId, resolvedTeams, predictions, outcomeType) {
  const teams = resolvedTeams[matchId];
  if (!teams) return "Por confirmar";
  
  const pred = predictions[matchId];
  if (!pred || pred.homeScore === undefined || pred.homeScore === "" || pred.awayScore === undefined || pred.awayScore === "") {
    const pLabel = matchId.replace("match_", "P");
    return outcomeType === "winner" ? `Ganador ${pLabel}` : `Perdedor ${pLabel}`;
  }
  
  const homeScore = parseInt(pred.homeScore);
  const awayScore = parseInt(pred.awayScore);
  
  let winner, loser;
  if (homeScore > awayScore) {
    winner = teams.homeTeam;
    loser = teams.awayTeam;
  } else if (homeScore < awayScore) {
    winner = teams.awayTeam;
    loser = teams.homeTeam;
  } else {
    if (pred.penaltyWinner === "away") {
      winner = teams.awayTeam;
      loser = teams.homeTeam;
    } else {
      winner = teams.homeTeam;
      loser = teams.awayTeam;
    }
  }
  
  return outcomeType === "winner" ? winner : loser;
}

function resolveAllMatchTeams(matches, predictions) {
  const resolved = {};
  
  matches.forEach(match => {
    if (match.stage.startsWith("Fase de Grupos")) {
      resolved[match.id] = { homeTeam: match.homeTeam, awayTeam: match.awayTeam };
    }
  });
  
  const standings = calculateStandings(matches, predictions);
  
  const groupWinners = {};
  const groupRunnersUp = {};
  const thirdPlacedTeams = [];
  
  Object.keys(standings).forEach(groupLetter => {
    const group = standings[groupLetter];
    if (group[0]) groupWinners[groupLetter] = group[0].team;
    if (group[1]) groupRunnersUp[groupLetter] = group[1].team;
    if (group[2]) {
      thirdPlacedTeams.push({
        team: group[2].team,
        group: groupLetter,
        points: group[2].points,
        gd: group[2].gd,
        gf: group[2].gf
      });
    }
  });
  
  thirdPlacedTeams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.group.localeCompare(b.group);
  });
  
  const qualifiedThirds = thirdPlacedTeams.slice(0, 8);
  const thirdAssignments = allocateThirdPlaces(qualifiedThirds);
  
  function getTeamByLabel(label, matchId) {
    if (!label) return "Por confirmar";
    
    if (!label.startsWith("1º Grupo") && !label.startsWith("2º Grupo") && !label.startsWith("3º Grupos")) {
      return label;
    }
    
    if (label.startsWith("1º Grupo")) {
      const g = label.slice(-1);
      return groupWinners[g] || label;
    }
    if (label.startsWith("2º Grupo")) {
      const g = label.slice(-1);
      return groupRunnersUp[g] || label;
    }
    if (label.startsWith("3º Grupos")) {
      return thirdAssignments[matchId] || label;
    }
    return label;
  }
  
  matches.forEach(match => {
    if (match.stage === "Dieciseisavos de Final") {
      resolved[match.id] = {
        homeTeam: getTeamByLabel(match.homeTeam, match.id),
        awayTeam: getTeamByLabel(match.awayTeam, match.id)
      };
    }
  });
  
  const knockoutMatchIds = [
    "match_89", "match_90", "match_91", "match_92", "match_93", "match_94", "match_95", "match_96",
    "match_97", "match_98", "match_99", "match_100",
    "match_101", "match_102",
    "match_103",
    "match_104"
  ];
  
  knockoutMatchIds.forEach(matchId => {
    const src = knockoutSources[matchId];
    if (src) {
      const is3rd = matchId === "match_103";
      resolved[matchId] = {
        homeTeam: getMatchOutcome(src.home, resolved, predictions, is3rd ? "loser" : "winner"),
        awayTeam: getMatchOutcome(src.away, resolved, predictions, is3rd ? "loser" : "winner")
      };
    }
  });
  
  return resolved;
}

function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Auth Form State
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // App State
  const [activeTab, setActiveTab] = useState("matches"); // "matches" | "leaderboard" | "admin"
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({}); // { [matchId]: { homeScore, awayScore } }
  const predictionsRef = React.useRef({});
  const [savingPredictions, setSavingPredictions] = useState({}); // { [matchId]: boolean }
  const [savedFeedback, setSavedFeedback] = useState({}); // { [matchId]: boolean }
  const [leaderboard, setLeaderboard] = useState([]);
  const [filterStage, setFilterStage] = useState("Todos");
  const [visualizeSubTab, setVisualizeSubTab] = useState("groups"); // "groups" | "bracket"
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Admin State
  const [adminScores, setAdminScores] = useState({}); // { [matchId]: { homeScore, awayScore } }
  const [recalculating, setRecalculating] = useState(false);
  const [adminMsg, setAdminMsg] = useState("");
  const [settings, setSettings] = useState({ whitelistEnabled: false });

  const resolvedTeams = React.useMemo(() => {
    return resolveAllMatchTeams(matches, predictions);
  }, [matches, predictions]);

  const allGroupMatchesPredicted = React.useMemo(() => {
    const groupMatches = matches.filter(m => m.stage.startsWith("Fase de Grupos"));
    if (groupMatches.length === 0) return false;
    return groupMatches.every(m => {
      const pred = predictions[m.id];
      return pred && pred.homeScore !== undefined && pred.homeScore !== "" && pred.awayScore !== undefined && pred.awayScore !== "";
    });
  }, [matches, predictions]);

  const allKnockoutMatchesPredicted = React.useMemo(() => {
    const knockoutMatches = matches.filter(m => !m.stage.startsWith("Fase de Grupos"));
    if (knockoutMatches.length === 0) return false;
    return knockoutMatches.every(m => {
      const pred = predictions[m.id];
      return pred && pred.homeScore !== undefined && pred.homeScore !== "" && pred.awayScore !== undefined && pred.awayScore !== "";
    });
  }, [matches, predictions]);

  // Listen for Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Load or create user profile in Firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        let profileData = null;
        if (userDoc.exists()) {
          profileData = userDoc.data();
        } else {
          profileData = {
            uid: currentUser.uid,
            displayName: currentUser.displayName || displayName || currentUser.email.split("@")[0],
            email: currentUser.email,
            totalPoints: 0,
            exactMatches: 0,
            correctOutcomes: 0,
            isAdmin: false
          };
          await setDoc(userDocRef, profileData);
        }
        setUserProfile(profileData);
        
        // Load User Predictions
        loadPredictions(currentUser.uid);
      } else {
        setUser(null);
        setUserProfile(null);
        setPredictions({});
        predictionsRef.current = {};
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Scroll to top listener
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Real-time listener for Matches
  useEffect(() => {
    const q = query(collection(db, "matches"), orderBy("date", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matchesData = [];
      snapshot.forEach((doc) => {
        matchesData.push({ id: doc.id, ...doc.data() });
      });
      setMatches(matchesData);
      
      // Initialize admin scores inputs with current scores
      const initialScores = {};
      matchesData.forEach(m => {
        initialScores[m.id] = {
          homeScore: m.homeScore !== null ? m.homeScore : "",
          awayScore: m.awayScore !== null ? m.awayScore : ""
        };
      });
      setAdminScores(initialScores);
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for Leaderboard
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("totalPoints", "desc"), orderBy("exactMatches", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leaderboardData = [];
      snapshot.forEach((doc) => {
        leaderboardData.push(doc.data());
      });
      setLeaderboard(leaderboardData);
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for Settings
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "config", "settings"), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data());
      } else {
        setSettings({ whitelistEnabled: false });
      }
    });
    return () => unsubscribe();
  }, []);

  // Load user predictions
  const loadPredictions = async (uid) => {
    const q = query(collection(db, "predictions"), where("userId", "==", uid));
    const querySnapshot = await getDocs(q);
    const userPredictions = {};
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      userPredictions[data.matchId] = {
        homeScore: data.homeScore,
        awayScore: data.awayScore,
        penaltyWinner: data.penaltyWinner || null
      };
    });
    setPredictions(userPredictions);
    predictionsRef.current = userPredictions;
  };

  // Auth Actions
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    const emailKey = email.toLowerCase().trim();
    try {
      // Verificar dinámicamente si el correo está en la lista blanca de Firestore (solo si está habilitada)
      if (settings.whitelistEnabled) {
        const whitelistDocRef = doc(db, "whitelist", emailKey);
        const whitelistDoc = await getDoc(whitelistDocRef);
        
        if (!whitelistDoc.exists()) {
          setAuthError("Este correo electrónico no está autorizado para acceder a esta porra.");
          setAuthLoading(false);
          return;
        }
      }

      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!displayName.trim()) {
          throw new Error("Por favor, ingresa un nombre para mostrar.");
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        
        const makeAdmin = false;
        
        const userDocRef = doc(db, "users", userCredential.user.uid);
        const profileData = {
          uid: userCredential.user.uid,
          displayName: displayName,
          email: email,
          totalPoints: 0,
          exactMatches: 0,
          correctOutcomes: 0,
          isAdmin: makeAdmin
        };
        await setDoc(userDocRef, profileData);
        setUserProfile(profileData);
        
        if (makeAdmin) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
      }
    } catch (error) {
      console.error(error);
      let translatedError = error.message;
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        translatedError = "Correo o contraseña incorrectos.";
      } else if (error.code === "auth/email-already-in-use") {
        translatedError = "El correo ya está en uso.";
      } else if (error.code === "auth/weak-password") {
        translatedError = "La contraseña debe tener al menos 6 caracteres.";
      } else if (error.code === "auth/invalid-email") {
        translatedError = "El formato de correo es inválido.";
      }
      setAuthError(translatedError);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError("");
    setAuthLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const userEmail = result.user.email;
      
      // Verificar dinámicamente si el correo está en la lista blanca de Firestore (solo si está habilitada)
      if (settings.whitelistEnabled) {
        const whitelistDocRef = doc(db, "whitelist", userEmail.toLowerCase().trim());
        const whitelistDoc = await getDoc(whitelistDocRef);
        
        if (!whitelistDoc.exists()) {
          await signOut(auth);
          setAuthError(`El correo ${userEmail} no está autorizado para acceder a esta porra.`);
          setAuthLoading(false);
          return;
        }
      }

      // Si está en la lista blanca, verificar si el perfil existe, si no, crearlo
      const userDocRef = doc(db, "users", result.user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        const usersSnap = await getDocs(collection(db, "users"));
        const isFirstUser = usersSnap.empty;
        const profileData = {
          uid: result.user.uid,
          displayName: result.user.displayName || result.user.email.split("@")[0],
          email: result.user.email,
          totalPoints: 0,
          exactMatches: 0,
          correctOutcomes: 0,
          isAdmin: isFirstUser
        };
        await setDoc(userDocRef, profileData);
        setUserProfile(profileData);
      }
    } catch (error) {
      console.error(error);
      let translatedError = error.message;
      if (error.code === "auth/popup-closed-by-user") {
        translatedError = "El inicio de sesión fue cancelado.";
      } else if (error.code === "auth/configuration-not-found") {
        translatedError = "El inicio de sesión con Google no está configurado en Firebase Console todavía.";
      }
      setAuthError(translatedError);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleLockGroupStage = async () => {
    if (!user) return;
    if (window.confirm("¿Estás seguro de que quieres cerrar la Fase de Grupos? Esto calculará el cuadro de eliminatorias en base a tus pronósticos y no podrás volver a editar los partidos de grupos.")) {
      try {
        const batch = writeBatch(db);
        const groupMatches = matches.filter(m => m.stage.startsWith("Fase de Grupos"));
        
        groupMatches.forEach(match => {
          const pred = predictionsRef.current[match.id];
          if (pred && pred.homeScore !== "" && pred.awayScore !== "" && pred.homeScore !== undefined && pred.awayScore !== undefined) {
            const predId = `${user.uid}_${match.id}`;
            const predDocRef = doc(db, "predictions", predId);
            batch.set(predDocRef, {
              userId: user.uid,
              userName: userProfile?.displayName || user.email.split("@")[0],
              userEmail: user.email,
              matchId: match.id,
              homeScore: parseInt(pred.homeScore),
              awayScore: parseInt(pred.awayScore),
              points: 0,
              checked: false
            }, { merge: true });
          }
        });
        
        const userDocRef = doc(db, "users", user.uid);
        batch.set(userDocRef, { groupStageLocked: true }, { merge: true });
        
        await batch.commit();
        
        setUserProfile(prev => ({ ...prev, groupStageLocked: true }));
        confetti({ particleCount: 120, spread: 80 });
        alert("¡Fase de grupos cerrada con éxito! La fase eliminatoria ha sido desbloqueada con tus selecciones.");
      } catch (e) {
        console.error(e);
        alert("Error al cerrar la fase de grupos: " + e.message);
      }
    }
  };

  const handleLockAllPredictions = async () => {
    if (!user) return;
    if (window.confirm("¿Estás seguro de que quieres enviar y bloquear tu porra? Una vez enviada, no podrás modificar ninguna predicción del torneo.")) {
      try {
        const batch = writeBatch(db);
        const knockoutMatches = matches.filter(m => !m.stage.startsWith("Fase de Grupos"));
        
        knockoutMatches.forEach(match => {
          const pred = predictionsRef.current[match.id];
          if (pred && pred.homeScore !== "" && pred.awayScore !== "" && pred.homeScore !== undefined && pred.awayScore !== undefined) {
            const predId = `${user.uid}_${match.id}`;
            const predDocRef = doc(db, "predictions", predId);
            const predData = {
              userId: user.uid,
              userName: userProfile?.displayName || user.email.split("@")[0],
              userEmail: user.email,
              matchId: match.id,
              homeScore: parseInt(pred.homeScore),
              awayScore: parseInt(pred.awayScore),
              points: 0,
              checked: false
            };
            if (pred.penaltyWinner) {
              predData.penaltyWinner = pred.penaltyWinner;
            }
            batch.set(predDocRef, predData, { merge: true });
          }
        });
        
        const userDocRef = doc(db, "users", user.uid);
        batch.set(userDocRef, { predictionsLocked: true }, { merge: true });
        
        await batch.commit();
        
        setUserProfile(prev => ({ ...prev, predictionsLocked: true }));
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.4 } });
        alert("¡Porra guardada y bloqueada con éxito! Mucha suerte en el Mundial 2026. 🏆");
      } catch (e) {
        console.error(e);
        alert("Error al bloquear las predicciones: " + e.message);
      }
    }
  };



  // Prediction Actions
  const handlePredictionChange = (matchId, teamType, val) => {
    const intVal = val === "" ? "" : parseInt(val);
    if (isNaN(intVal) && val !== "") return;
    
    setPredictions(prev => {
      const updated = {
        ...prev,
        [matchId]: {
          ...prev[matchId],
          [teamType]: intVal
        }
      };
      predictionsRef.current = updated;
      return updated;
    });
  };

  const handleSelectPenaltyWinner = (matchId, winnerType) => {
    const currentPred = predictionsRef.current[matchId] || { homeScore: "", awayScore: "" };
    const updatedPred = { ...currentPred, penaltyWinner: winnerType };
    
    setPredictions(prev => {
      const updated = {
        ...prev,
        [matchId]: updatedPred
      };
      predictionsRef.current = updated;
      return updated;
    });
    
    savePrediction(matchId, updatedPred);
  };

  const savePrediction = async (matchId, customPred = null) => {
    if (!user) return;
    
    const pred = customPred || predictionsRef.current[matchId];
    if (pred === undefined || pred.homeScore === "" || pred.awayScore === "" || pred.homeScore === undefined || pred.awayScore === undefined) {
      return;
    }

    setSavingPredictions(prev => ({ ...prev, [matchId]: true }));
    
    try {
      const predId = `${user.uid}_${matchId}`;
      const predDocRef = doc(db, "predictions", predId);
      
      const predData = {
        userId: user.uid,
        userName: userProfile?.displayName || user.email.split("@")[0],
        userEmail: user.email,
        matchId: matchId,
        homeScore: parseInt(pred.homeScore),
        awayScore: parseInt(pred.awayScore),
        points: 0,
        checked: false
      };
      
      if (pred.penaltyWinner) {
        predData.penaltyWinner = pred.penaltyWinner;
      }
      
      await setDoc(predDocRef, predData, { merge: true });

      setSavedFeedback(prev => ({ ...prev, [matchId]: true }));
      setTimeout(() => {
        setSavedFeedback(prev => ({ ...prev, [matchId]: false }));
      }, 2000);
      
    } catch (e) {
      console.error("Error auto-saving prediction:", e);
    } finally {
      setSavingPredictions(prev => ({ ...prev, [matchId]: false }));
    }
  };

  // Admin Actions: Seed initial matches
  const handleSeedDatabase = async () => {
    if (!userProfile?.isAdmin) return;
    if (window.confirm("¿Seguro que quieres inicializar la base de datos con los partidos por defecto del Mundial?")) {
      try {
        const batch = writeBatch(db);
        initialMatches.forEach((match) => {
          const matchDocRef = doc(db, "matches", match.id);
          batch.set(matchDocRef, match);
        });
        await batch.commit();
        alert("¡Base de datos de partidos sembrada correctamente!");
      } catch (e) {
        console.error(e);
        alert("Error al sembrar partidos: " + e.message);
      }
    }
  };

  const handleAdminScoreChange = (matchId, teamType, val) => {
    const intVal = val === "" ? "" : parseInt(val);
    if (isNaN(intVal) && val !== "") return;

    setAdminScores(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [teamType]: intVal
      }
    }));
  };

  // Save match result & trigger recalculation of points
  const handleSaveResult = async (matchId) => {
    if (!userProfile?.isAdmin) return;
    const scores = adminScores[matchId];
    if (scores.homeScore === "" || scores.awayScore === "") {
      alert("Por favor, ingresa los resultados de ambos equipos.");
      return;
    }

    setRecalculating(true);
    setAdminMsg(`Procesando resultado para el partido...`);

    try {
      const matchDocRef = doc(db, "matches", matchId);
      const homeScore = parseInt(scores.homeScore);
      const awayScore = parseInt(scores.awayScore);

      // 1. Update Match Score in Firestore
      await setDoc(matchDocRef, {
        homeScore,
        awayScore,
        status: "finished"
      }, { merge: true });

      // 2. Query all predictions for this match
      const predQuery = query(collection(db, "predictions"), where("matchId", "==", matchId));
      const predSnap = await getDocs(predQuery);

      const batch = writeBatch(db);
      const updatedUserIds = new Set();

      predSnap.forEach((predictionDoc) => {
        const predData = predictionDoc.data();
        const predHome = predData.homeScore;
        const predAway = predData.awayScore;
        
        let points = 0;
        
        // Exact score = 3 points
        if (predHome === homeScore && predAway === awayScore) {
          points = 3;
        } 
        // Correct winner / draw = 1 point
        else if (Math.sign(predHome - predAway) === Math.sign(homeScore - awayScore)) {
          points = 1;
        }

        // Add to batch update
        batch.update(doc(db, "predictions", predictionDoc.id), {
          points: points,
          checked: true
        });

        updatedUserIds.add(predData.userId);
      });

      // Commit predictions points update
      await batch.commit();

      // 3. Recalculate total points for affected users
      setAdminMsg(`Recalculando tabla de clasificación...`);
      const usersSnap = await getDocs(collection(db, "users"));
      
      for (const uDoc of usersSnap.docs) {
        const uData = uDoc.data();
        const uId = uData.uid;

        // Query all predictions of this user
        const userPredsQuery = query(collection(db, "predictions"), where("userId", "==", uId));
        const userPredsSnap = await getDocs(userPredsQuery);

        let totalPoints = 0;
        let exactMatches = 0;
        let correctOutcomes = 0;

        userPredsSnap.forEach((pDoc) => {
          const pData = pDoc.data();
          // Find corresponding match to verify if it is finished
          const matchObj = matches.find(m => m.id === pData.matchId);
          // If match is finished or marked as finished in state
          const isFinished = matchObj ? (matchObj.status === "finished" || matchObj.id === matchId) : false;

          if (isFinished) {
            const matchH = matchObj.id === matchId ? homeScore : matchObj.homeScore;
            const matchA = matchObj.id === matchId ? awayScore : matchObj.awayScore;
            
            if (matchH !== null && matchA !== null) {
              const pHome = pData.homeScore;
              const pAway = pData.awayScore;
              
              if (pHome === matchH && pAway === matchA) {
                totalPoints += 3;
                exactMatches += 1;
              } else if (Math.sign(pHome - pAway) === Math.sign(matchH - matchA)) {
                totalPoints += 1;
                correctOutcomes += 1;
              }
            }
          }
        });

        // Update user stats
        await setDoc(doc(db, "users", uId), {
          totalPoints,
          exactMatches,
          correctOutcomes
        }, { merge: true });
      }

      setAdminMsg("¡Resultado y puntajes actualizados correctamente!");
      confetti({ particleCount: 150, spread: 80 });
      setTimeout(() => setAdminMsg(""), 3000);
      
    } catch (e) {
      console.error(e);
      alert("Error al procesar el resultado: " + e.message);
    } finally {
      setRecalculating(false);
    }
  };

  // Filter stage groups
  const stages = [
    "Todos", 
    "Grupo A", "Grupo B", "Grupo C", "Grupo D", "Grupo E", "Grupo F", "Grupo G", "Grupo H", "Grupo I", "Grupo J", "Grupo K", "Grupo L",
    "Dieciseisavos", "Octavos", "Cuartos", "Semifinales", "Tercer Puesto", "Final"
  ];
  const filteredMatches = filterStage === "Todos" 
    ? matches 
    : matches.filter(m => m.stage.includes(filterStage));

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <RefreshCw style={{ animation: 'spin 1.5s linear infinite', color: '#00ff87' }} size={48} />
        <p style={{ color: '#94a3b8', fontSize: '1.1rem', fontWeight: 600 }}>Cargando Porra del Mundial...</p>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Welcome / Auth Page
  if (!user) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '40px 32px' }}>
          
          {/* Logo & Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '32px', textAlign: 'center' }}>
            <div style={{ background: 'rgba(0, 255, 135, 0.1)', border: '2px solid rgba(0, 255, 135, 0.3)', width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(0,255,135,0.2)' }}>
              <Trophy size={32} style={{ color: '#00ff87' }} />
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '12px' }}>
              PORRA <span className="title-gradient">MUNDIAL 2026</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {isLogin ? "Inicia sesión para registrar tus pronósticos" : "Crea tu cuenta de competidor"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {!isLogin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tu Nombre o Apodo</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="Ej. Ricardo" 
                    className="form-input" 
                    style={{ paddingLeft: '44px' }}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Correo Electrónico</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  placeholder="tucorreo@ejemplo.com" 
                  className="form-input" 
                  style={{ paddingLeft: '44px' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  placeholder="Mínimo 6 caracteres" 
                  className="form-input" 
                  style={{ paddingLeft: '44px' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>



            {authError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(255, 77, 109, 0.1)', border: '1px solid rgba(255, 77, 109, 0.2)', borderRadius: '8px', color: 'var(--accent-red)', fontSize: '0.85rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{authError}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={authLoading}>
              {authLoading ? (
                <RefreshCw style={{ animation: 'spin 1s linear infinite' }} size={18} />
              ) : isLogin ? (
                "Entrar a la Porra"
              ) : (
                "Crear Cuenta"
              )}
            </button>
          </form>

          {/* Separador */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>o bien</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
          </div>

          {/* Botón de Google */}
          <button 
            type="button" 
            onClick={handleGoogleAuth} 
            className="btn" 
            style={{ 
              width: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '10px', 
              background: 'rgba(255, 255, 255, 0.05)', 
              border: '1px solid rgba(255, 255, 255, 0.1)', 
              color: '#fff', 
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              padding: '12px',
              borderRadius: '12px'
            }}
            disabled={authLoading}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >
            {authLoading ? (
              <RefreshCw style={{ animation: 'spin 1s linear infinite' }} size={18} />
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Acceder con Google</span>
              </>
            )}
          </button>

          {/* Toggle login/register */}
          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {isLogin ? "¿No tienes cuenta? " : "¿Ya tienes una cuenta? "}
            </span>
            <button 
              type="button" 
              style={{ background: 'none', border: 'none', color: '#00ff87', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => {
                setIsLogin(!isLogin);
                setAuthError("");
              }}
            >
              {isLogin ? "Regístrate ahora" : "Inicia sesión"}
            </button>
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Nota: Si eres el primer usuario en registrarse, obtendrás acceso de Administrador automáticamente.
          </div>
        </div>
      </div>
    );
  }

  const getPredictedWinnerName = () => {
    const matchId = "match_104";
    const pred = predictionsRef.current[matchId];
    if (!pred || pred.homeScore === undefined || pred.homeScore === "" || pred.awayScore === undefined || pred.awayScore === "") {
      return null;
    }
    const teams = resolvedTeams[matchId];
    if (!teams) return null;
    
    const homeScore = parseInt(pred.homeScore);
    const awayScore = parseInt(pred.awayScore);
    if (homeScore > awayScore) return teams.homeTeam;
    if (awayScore > homeScore) return teams.awayTeam;
    if (pred.penaltyWinner === "home") return teams.homeTeam;
    if (pred.penaltyWinner === "away") return teams.awayTeam;
    return null;
  };

  const downloadShareImage = () => {
    const winnerName = getPredictedWinnerName();
    if (!winnerName) return;

    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");

    // 1. Draw background gradient
    const gradient = ctx.createRadialGradient(600, 315, 100, 600, 315, 700);
    gradient.addColorStop(0, "#192030");
    gradient.addColorStop(1, "#0a0d14");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 630);

    // 2. Draw soccer stadium lights aesthetic
    ctx.strokeStyle = "rgba(0, 255, 135, 0.1)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(600, 630, 400, Math.PI, 0);
    ctx.stroke();

    ctx.strokeStyle = "rgba(0, 229, 255, 0.08)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(600, 630, 250, Math.PI, 0);
    ctx.stroke();

    // 3. Draw Header Title
    ctx.fillStyle = "#94a3b8";
    ctx.font = "800 24px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PORRA MUNDIAL 2026 🏆", 600, 110);

    // 4. Draw Subtitle
    ctx.fillStyle = "#ffffff";
    ctx.font = "500 36px Outfit, sans-serif";
    ctx.fillText("Mi ganador del mundial es:", 600, 240);

    // 5. Draw Champion Name with Glow Effect
    ctx.shadowColor = "#ffb703";
    ctx.shadowBlur = 25;
    ctx.fillStyle = "#ffb703"; // Gold
    ctx.font = "800 70px Outfit, sans-serif";
    ctx.fillText(winnerName.toUpperCase(), 600, 360);

    // Reset shadow for subsequent drawings
    ctx.shadowBlur = 0;

    // 6. Draw Footer Link & Promotion
    ctx.fillStyle = "#00ff87"; // Neon Green
    ctx.font = "600 28px Outfit, sans-serif";
    ctx.fillText("worldcup-499120.web.app", 600, 500);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "400 18px Outfit, sans-serif";
    ctx.fillText("¡Completa tu porra y compite con tus amigos!", 600, 545);

    // 7. Trigger file download
    const link = document.createElement("a");
    link.download = `porra_mundial_campeon_${winnerName.toLowerCase().replace(/\s+/g, "_")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleShareWhatsApp = () => {
    const winnerName = getPredictedWinnerName();
    if (!winnerName) return;

    const message = `🏆 ¡He completado mi porra del Mundial 2026! Mi campeón predicho es *${winnerName.toUpperCase()}*. Rellena tu porra y compite en la clasificación general en: https://worldcup-499120.web.app/`;
    const encodedText = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, "_blank");
  };

  const renderBracketMatch = (matchId) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return null;

    const pred = predictionsRef.current[matchId] || { homeScore: "", awayScore: "" };
    const homeTeam = resolvedTeams[matchId]?.homeTeam || match.homeTeam;
    const awayTeam = resolvedTeams[matchId]?.awayTeam || match.awayTeam;

    const isHomeUnresolved = homeTeam.startsWith("1º") || homeTeam.startsWith("2º") || homeTeam.startsWith("3º") || homeTeam.startsWith("Ganador") || homeTeam.startsWith("Perdedor") || homeTeam === "Por confirmar";
    const isAwayUnresolved = awayTeam.startsWith("1º") || awayTeam.startsWith("2º") || awayTeam.startsWith("3º") || awayTeam.startsWith("Ganador") || awayTeam.startsWith("Perdedor") || awayTeam === "Por confirmar";

    const hasPrediction = pred.homeScore !== "" && pred.awayScore !== "" && pred.homeScore !== undefined && pred.awayScore !== undefined;

    let isHomeWinner = false;
    let isAwayWinner = false;

    if (hasPrediction) {
      const homeVal = parseInt(pred.homeScore);
      const awayVal = parseInt(pred.awayScore);
      if (homeVal > awayVal) {
        isHomeWinner = true;
      } else if (awayVal > homeVal) {
        isAwayWinner = true;
      } else {
        if (pred.penaltyWinner === "home") {
          isHomeWinner = true;
        } else if (pred.penaltyWinner === "away") {
          isAwayWinner = true;
        }
      }
    }

    return (
      <div key={matchId} className="visualize-match-card">
        {/* Home Team */}
        <div className="bracket-team-row" style={{ 
          opacity: isHomeUnresolved ? 0.45 : (hasPrediction ? (isHomeWinner ? 1 : 0.45) : 0.8),
          fontWeight: isHomeWinner ? 700 : 400,
          color: isHomeWinner ? 'var(--accent-green)' : 'var(--text-primary)'
        }}>
          <span className="bracket-team-name" style={{ fontStyle: isHomeUnresolved ? 'italic' : 'normal' }}>
            {homeTeam}
          </span>
          <span className="bracket-team-score">
            {hasPrediction ? pred.homeScore : "-"}
            {hasPrediction && pred.homeScore === pred.awayScore && pred.penaltyWinner === "home" && (
              <span style={{ fontSize: '0.65rem', color: 'var(--accent-gold)', marginLeft: '3px' }}>(pen)</span>
            )}
          </span>
        </div>

        {/* Separator line */}
        <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

        {/* Away Team */}
        <div className="bracket-team-row" style={{ 
          opacity: isAwayUnresolved ? 0.45 : (hasPrediction ? (isAwayWinner ? 1 : 0.45) : 0.8),
          fontWeight: isAwayWinner ? 700 : 400,
          color: isAwayWinner ? 'var(--accent-green)' : 'var(--text-primary)'
        }}>
          <span className="bracket-team-name" style={{ fontStyle: isAwayUnresolved ? 'italic' : 'normal' }}>
            {awayTeam}
          </span>
          <span className="bracket-team-score">
            {hasPrediction ? pred.awayScore : "-"}
            {hasPrediction && pred.homeScore === pred.awayScore && pred.penaltyWinner === "away" && (
              <span style={{ fontSize: '0.65rem', color: 'var(--accent-gold)', marginLeft: '3px' }}>(pen)</span>
            )}
          </span>
        </div>

        {/* Card Footer */}
        <div className="bracket-match-footer">
          Partido {matchId.split('_')[1]} • {match.stage.replace("Dieciseisavos de Final", "Dieciseisavos").replace("Octavos de Final", "Octavos").replace("Cuartos de Final", "Cuartos")}
        </div>
      </div>
    );
  };

  // Logged In Application Layout
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header / Navbar */}
      <header className="glass-panel main-header">
        <div className="header-container">
          
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trophy size={26} style={{ color: '#00ff87' }} />
            <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              PORRA <span className="accent-gradient">MUNDIAL 2026</span>
            </span>
          </div>

          {/* Tab Navigation */}
          <nav className="header-nav">
            <button 
              className={`btn ${activeTab === 'matches' ? 'active' : ''}`}
              onClick={() => setActiveTab("matches")}
            >
              <Calendar size={15} />
              <span>Partidos</span>
            </button>

            <button 
              className={`btn ${activeTab === 'visualize' ? 'active' : ''}`}
              onClick={() => setActiveTab("visualize")}
            >
              <Eye size={15} />
              <span>Visualizar</span>
            </button>
            
            <button 
              className={`btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
              onClick={() => setActiveTab("leaderboard")}
            >
              <Users size={15} />
              <span>Clasificación</span>
            </button>

            {userProfile?.isAdmin && (
              <button 
                className={`btn ${activeTab === 'admin' ? 'active' : ''}`}
                style={{ color: '#00ff87' }}
                onClick={() => setActiveTab("admin")}
              >
                <Shield size={15} />
                <span>Admin</span>
              </button>
            )}
          </nav>

          {/* User Info / Logout */}
          <div className="header-user-section">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{userProfile?.displayName}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="badge badge-green" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                  {userProfile?.totalPoints || 0} Pts
                </span>
                {userProfile?.isAdmin && (
                  <span className="badge badge-gold" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                    Admin
                  </span>
                )}
              </div>
            </div>
            
            <button 
              className="btn btn-secondary" 
              style={{ padding: '10px', borderRadius: '10px' }}
              onClick={handleLogout}
              title="Cerrar Sesión"
            >
              <LogOut size={16} />
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, maxWidth: '1000px', width: '100%', margin: '0 auto', padding: '32px 20px' }}>
        
        {/* TAB 1: MATCHES & PREDICTIONS */}
        {activeTab === "matches" && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Header info card */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <div style={{ flex: '1 1 300px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Tus Pronósticos del Mundial</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                  Guarda tus marcadores para cada partido. Recibirás <strong>3 puntos</strong> por acertar el marcador exacto y <strong>1 punto</strong> por acertar el ganador o empate.
                </p>
                {userProfile?.predictionsLocked && (
                  <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#00ff87', fontWeight: 700, fontSize: '0.85rem', background: 'rgba(0, 255, 135, 0.1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(0, 255, 135, 0.2)' }}>
                    <CheckCircle2 size={14} />
                    <span>Tus pronósticos están enviados y bloqueados. ¡Buena suerte!</span>
                  </div>
                )}
                {!userProfile?.predictionsLocked && userProfile?.groupStageLocked && (
                  <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ffb703', fontWeight: 700, fontSize: '0.85rem', background: 'rgba(255, 183, 3, 0.1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(255, 183, 3, 0.2)' }}>
                    <Shield size={14} />
                    <span>Fase de grupos cerrada. Rellena las eliminatorias y bloquea al terminar.</span>
                  </div>
                )}
              </div>

              {/* Botones de Acción de Bloqueo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
                {!userProfile?.groupStageLocked && (
                  <button
                    onClick={handleLockGroupStage}
                    disabled={!allGroupMatchesPredicted}
                    className="btn btn-primary"
                    style={{ 
                      padding: '10px 20px', 
                      borderRadius: '8px', 
                      fontSize: '0.85rem', 
                      fontWeight: 700, 
                      opacity: allGroupMatchesPredicted ? 1 : 0.6,
                      cursor: allGroupMatchesPredicted ? 'pointer' : 'not-allowed',
                      boxShadow: allGroupMatchesPredicted ? '0 0 15px rgba(0, 255, 135, 0.3)' : 'none'
                    }}
                  >
                    Cerrar Fase de Grupos
                  </button>
                )}

                {userProfile?.groupStageLocked && !userProfile?.predictionsLocked && (
                  <button
                    onClick={handleLockAllPredictions}
                    disabled={!allKnockoutMatchesPredicted}
                    className="btn btn-primary"
                    style={{ 
                      padding: '10px 20px', 
                      borderRadius: '8px', 
                      fontSize: '0.85rem', 
                      fontWeight: 700, 
                      background: 'linear-gradient(135deg, #ffb703 0%, #ff8500 100%)',
                      borderColor: '#ff8500',
                      color: '#000',
                      opacity: allKnockoutMatchesPredicted ? 1 : 0.6,
                      cursor: allKnockoutMatchesPredicted ? 'pointer' : 'not-allowed',
                      boxShadow: allKnockoutMatchesPredicted ? '0 0 15px rgba(255, 183, 3, 0.4)' : 'none'
                    }}
                  >
                    Confirmar y Bloquear Porra 🏆
                  </button>
                )}


              </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', whiteSpace: 'nowrap' }}>
              {stages.map((stage) => (
                <button 
                  key={stage}
                  className={`btn ${filterStage === stage ? 'btn-secondary' : ''}`}
                  style={{ 
                    padding: '6px 14px', 
                    borderRadius: '20px', 
                    fontSize: '0.8rem',
                    background: filterStage === stage ? 'var(--bg-tertiary)' : 'rgba(255, 255, 255, 0.02)',
                    border: filterStage === stage ? '1px solid var(--accent-green)' : '1px solid var(--border-color)',
                  }}
                  onClick={() => setFilterStage(stage)}
                >
                  {stage}
                </button>
              ))}
            </div>

            {/* Matches list */}
            {filteredMatches.length === 0 ? (
              <div className="glass-panel" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p>No hay partidos configurados para esta fase en este momento.</p>
                {userProfile?.isAdmin && (
                  <button 
                    onClick={() => setActiveTab("admin")}
                    className="btn btn-primary"
                    style={{ marginTop: '16px' }}
                  >
                    Ir al panel de Admin para sembrar partidos
                  </button>
                )}
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                {filteredMatches.map((match) => {
                  const pred = predictions[match.id] || { homeScore: "", awayScore: "" };
                  const isFinished = match.status === "finished";
                  const isSaved = predictions[match.id] !== undefined;
                  
                  const isGroupStage = match.stage.startsWith("Fase de Grupos");
                  const isPredictionDisabled = isFinished || 
                    userProfile?.predictionsLocked === true ||
                    (isGroupStage && userProfile?.groupStageLocked === true);

                  const homeTeamName = resolvedTeams[match.id]?.homeTeam || match.homeTeam;
                  const awayTeamName = resolvedTeams[match.id]?.awayTeam || match.awayTeam;

                  // Evaluate points calculation preview
                  let ptsEarned = null;
                  if (isFinished && isSaved) {
                    if (pred.homeScore === match.homeScore && pred.awayScore === match.awayScore) {
                      ptsEarned = 3;
                    } else if (Math.sign(pred.homeScore - pred.awayScore) === Math.sign(match.homeScore - match.awayScore)) {
                      ptsEarned = 1;
                    } else {
                      ptsEarned = 0;
                    }
                  }

                  return (
                    <div 
                      key={match.id} 
                      className={`match-card glass-panel ${isFinished ? 'finished' : 'glow-green'}`}
                    >
                      {/* Match Stage & Date */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                          <span className="badge badge-gray">{match.stage}</span>
                        </div>
                        <div>
                          {new Date(match.date).toLocaleString('es-ES', { 
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                          })}
                        </div>
                      </div>

                      {/* Teams & Score inputs container */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
                        
                        {/* Home Team */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 180px' }}>
                          <div className="team-logo-placeholder">
                            {homeTeamName.substring(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{homeTeamName}</span>
                        </div>

                        {/* Middle: Prediction inputs or scores */}
                        <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'center', gap: '16px', margin: '0 auto' }}>
                          
                          {/* Home Input / Label */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <input 
                              type="number"
                              min="0"
                              placeholder="-"
                              className="score-input"
                              value={pred.homeScore}
                              disabled={isPredictionDisabled}
                              onChange={(e) => handlePredictionChange(match.id, "homeScore", e.target.value)}
                              onBlur={() => savePrediction(match.id)}
                            />
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>PRON.</span>
                          </div>

                          {/* Vs separator / Actual match result */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            {isFinished ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-green)' }}>{match.homeScore}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>VS</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-green)' }}>{match.awayScore}</span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>VS</span>
                            )}
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              {isFinished ? "REAL" : "ESTADO"}
                            </span>
                          </div>

                          {/* Away Input / Label */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <input 
                              type="number"
                              min="0"
                              placeholder="-"
                              className="score-input"
                              value={pred.awayScore}
                              disabled={isPredictionDisabled}
                              onChange={(e) => handlePredictionChange(match.id, "awayScore", e.target.value)}
                              onBlur={() => savePrediction(match.id)}
                            />
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>PRON.</span>
                          </div>

                        </div>

                        {/* Away Team */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', flex: '1 1 180px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{awayTeamName}</span>
                          <div className="team-logo-placeholder" style={{ background: 'linear-gradient(135deg, var(--bg-tertiary) 0%, rgba(25, 32, 48, 0.5) 100%)' }}>
                            {awayTeamName.substring(0, 2).toUpperCase()}
                          </div>
                        </div>

                      </div>

                      {/* Tanda de penaltis si hay empate en eliminatorias */}
                      {!isGroupStage && pred.homeScore !== "" && pred.awayScore !== "" && parseInt(pred.homeScore) === parseInt(pred.awayScore) && (
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          gap: '8px', 
                          marginTop: '16px', 
                          width: '100%', 
                          padding: '10px', 
                          background: 'rgba(255, 255, 255, 0.02)', 
                          borderRadius: '8px', 
                          border: '1px dashed rgba(255, 255, 255, 0.1)' 
                        }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            Empate pronosticado. ¿Quién avanza por penaltis?
                          </span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              disabled={isPredictionDisabled}
                              onClick={() => handleSelectPenaltyWinner(match.id, "home")}
                              className={`btn ${pred.penaltyWinner !== "away" ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '15px' }}
                            >
                              {homeTeamName}
                            </button>
                            <button
                              type="button"
                              disabled={isPredictionDisabled}
                              onClick={() => handleSelectPenaltyWinner(match.id, "away")}
                              className={`btn ${pred.penaltyWinner === "away" ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '15px' }}
                            >
                              {awayTeamName}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Footer Actions / Points outcome */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
                        <div>
                          {isFinished ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              Resultado Finalizado
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: isSaved ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                              {isSaved ? "✓ Pronóstico guardado" : "Pronóstico pendiente"}
                            </span>
                          )}
                        </div>

                        <div>
                          {isFinished ? (
                            ptsEarned !== null ? (
                              <span className={`badge ${ptsEarned === 3 ? 'badge-gold' : ptsEarned === 1 ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                                {ptsEarned === 3 ? "¡Marcador Exacto! +3 Pts" : ptsEarned === 1 ? "¡Ganador Correcto! +1 Pt" : "0 Puntos"}
                              </span>
                            ) : (
                              <span className="badge badge-gray" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                                Sin pronóstico (0 Pts)
                              </span>
                            )
                          ) : (
                            <button 
                              onClick={() => savePrediction(match.id)}
                              disabled={savingPredictions[match.id] || isPredictionDisabled}
                              className={`btn ${isSaved ? 'btn-secondary' : 'btn-primary'}`}
                              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem' }}
                            >
                              {savingPredictions[match.id] ? (
                                <RefreshCw style={{ animation: 'spin 1s linear infinite' }} size={14} />
                              ) : savedFeedback[match.id] ? (
                                <>
                                  <Check size={14} style={{ color: '#00ff87' }} />
                                  <span>Guardado</span>
                                </>
                              ) : (
                                <>
                                  <Save size={14} />
                                  <span>{isSaved ? "Actualizar" : "Guardar Pronóstico"}</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

              {/* Botones de Acción de Bloqueo al final de la lista */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px', 
                alignItems: 'center', 
                justifyContent: 'center', 
                marginTop: '32px',
                padding: '24px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px'
              }}>
                {!userProfile?.groupStageLocked && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      {allGroupMatchesPredicted ? "🎉 ¡Has completado todos los partidos de grupos! Ya puedes cerrar la fase." : "Completa todos los partidos de grupos para poder cerrar la fase."}
                    </p>
                    <button
                      onClick={handleLockGroupStage}
                      disabled={!allGroupMatchesPredicted}
                      className="btn btn-primary"
                      style={{ 
                        padding: '12px 24px', 
                        borderRadius: '8px', 
                        fontSize: '0.9rem', 
                        fontWeight: 700, 
                        opacity: allGroupMatchesPredicted ? 1 : 0.6,
                        cursor: allGroupMatchesPredicted ? 'pointer' : 'not-allowed',
                        boxShadow: allGroupMatchesPredicted ? '0 0 20px rgba(0, 255, 135, 0.4)' : 'none'
                      }}
                    >
                      Cerrar Fase de Grupos
                    </button>
                  </div>
                )}

                {userProfile?.groupStageLocked && !userProfile?.predictionsLocked && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      {allKnockoutMatchesPredicted ? "🎉 ¡Has completado todos los pronósticos de eliminatorias! Bloquea tu porra definitiva aquí." : "Completa todos los partidos eliminatorios para poder bloquear tu porra."}
                    </p>
                    <button
                      onClick={handleLockAllPredictions}
                      disabled={!allKnockoutMatchesPredicted}
                      className="btn btn-primary"
                      style={{ 
                        padding: '12px 24px', 
                        borderRadius: '8px', 
                        fontSize: '0.9rem', 
                        fontWeight: 700, 
                        background: 'linear-gradient(135deg, #ffb703 0%, #ff8500 100%)',
                        borderColor: '#ff8500',
                        color: '#000',
                        opacity: allKnockoutMatchesPredicted ? 1 : 0.6,
                        cursor: allKnockoutMatchesPredicted ? 'pointer' : 'not-allowed',
                        boxShadow: allKnockoutMatchesPredicted ? '0 0 20px rgba(255, 183, 3, 0.5)' : 'none'
                      }}
                    >
                      Confirmar y Bloquear Porra 🏆
                    </button>
                  </div>
                )}
              </div>
            </>)}
          </div>
        )}

        {/* TAB: VISUALIZE */}
        {activeTab === "visualize" && (
          <div className="animate-fade-in" style={{ width: '100%' }}>
            {/* Title */}
            <div className="glass-panel" style={{ padding: '24px 32px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Eye size={28} style={{ color: 'var(--accent-blue)' }} />
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Visualización del Mundial</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
                    Sigue y visualiza de forma gráfica el progreso de tus pronósticos.
                  </p>
                </div>
              </div>
            </div>

            {/* Share Widget Card */}
            <div className="glass-panel animate-fade-in" style={{ 
              padding: '24px 32px', 
              marginBottom: '24px', 
              border: getPredictedWinnerName() ? '1px solid rgba(255, 183, 3, 0.3)' : '1px solid var(--border-color)',
              background: getPredictedWinnerName() ? 'linear-gradient(135deg, rgba(25, 32, 48, 0.85) 0%, rgba(35, 30, 20, 0.85) 100%)' : 'var(--bg-card)'
            }}>
              {getPredictedWinnerName() ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ 
                      background: 'rgba(255, 183, 3, 0.1)', 
                      borderRadius: '50%', 
                      width: '56px', 
                      height: '56px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      boxShadow: '0 0 15px rgba(255, 183, 3, 0.2)'
                    }}>
                      <Trophy size={28} style={{ color: 'var(--accent-gold)' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ¡Tienes un Campeón! 🏆
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
                        Tu ganador predicho del Mundial es <strong style={{ color: 'var(--accent-gold)' }}>{getPredictedWinnerName().toUpperCase()}</strong>. ¡Comparte tu porra con tus amigos!
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {/* Share on WhatsApp */}
                    <button 
                      onClick={handleShareWhatsApp}
                      className="btn"
                      style={{ 
                        background: '#25D366', 
                        color: '#000', 
                        border: 'none', 
                        padding: '10px 20px', 
                        fontSize: '0.85rem', 
                        borderRadius: '10px',
                        boxShadow: '0 4px 10px rgba(37, 211, 102, 0.3)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Share2 size={16} />
                      <span>Compartir por WhatsApp</span>
                    </button>

                    {/* Download Canvas Image */}
                    <button 
                      onClick={downloadShareImage}
                      className="btn btn-secondary"
                      style={{ 
                        padding: '10px 20px', 
                        fontSize: '0.85rem', 
                        borderRadius: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Save size={16} />
                      <span>Descargar Imagen</span>
                    </button>

                    {/* Copy Link */}
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText("https://worldcup-499120.web.app");
                        alert("¡Enlace de la porra copiado al portapapeles!");
                      }}
                      className="btn btn-secondary"
                      style={{ 
                        padding: '10px 20px', 
                        fontSize: '0.85rem', 
                        borderRadius: '10px' 
                      }}
                    >
                      <span>Copiar Enlace</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ 
                    background: 'rgba(255, 255, 255, 0.05)', 
                    borderRadius: '50%', 
                    width: '56px', 
                    height: '56px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center'
                  }}>
                    <Star size={24} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      ¿Quieres compartir tu predicción?
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
                      Completa tus pronósticos en la pestaña <strong>Partidos</strong> hasta llegar a la Gran Final para elegir tu campeón y desbloquear las opciones de compartir.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sub-tabs Selection */}
            <div className="visualize-subtabs">
              <button 
                className={`btn ${visualizeSubTab === 'groups' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '0.85rem' }}
                onClick={() => setVisualizeSubTab("groups")}
              >
                Fase de Grupos
              </button>
              <button 
                className={`btn ${visualizeSubTab === 'bracket' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '0.85rem' }}
                onClick={() => setVisualizeSubTab("bracket")}
              >
                Fase Eliminatoria
              </button>
            </div>

            {/* Sub-tab Content: Groups */}
            {visualizeSubTab === "groups" && (
              <div className="visualize-groups-grid">
                {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map(groupLetter => {
                  const standings = calculateStandings(matches, predictionsRef.current)[groupLetter] || [];
                  return (
                    <div key={groupLetter} className="glass-panel visualize-group-card glow-green">
                      <div className="visualize-group-title">Grupo {groupLetter}</div>
                      <table className="visualize-group-table">
                        <thead>
                          <tr>
                            <th style={{ width: '25px', textAlign: 'center' }}>#</th>
                            <th>Selección</th>
                            <th style={{ width: '25px', textAlign: 'center' }}>PJ</th>
                            <th style={{ width: '30px', textAlign: 'center' }}>DG</th>
                            <th style={{ width: '30px', textAlign: 'center' }}>Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((row, idx) => {
                            const isTop2 = idx < 2;
                            const is3rd = idx === 2;
                            let indicatorColor = 'transparent';
                            if (isTop2) indicatorColor = 'var(--accent-green)';
                            else if (is3rd) indicatorColor = 'var(--accent-gold)';

                            return (
                              <tr key={row.team}>
                                <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                                  <span style={{ 
                                    display: 'inline-block', 
                                    width: '18px', 
                                    height: '18px', 
                                    lineHeight: '18px', 
                                    borderRadius: '50%', 
                                    background: indicatorColor !== 'transparent' ? indicatorColor : 'rgba(255,255,255,0.05)', 
                                    color: indicatorColor !== 'transparent' ? '#000' : 'var(--text-secondary)',
                                    fontSize: '0.7rem',
                                    fontWeight: 700
                                  }}>
                                    {idx + 1}
                                  </span>
                                </td>
                                <td style={{ fontWeight: isTop2 ? 600 : 400 }}>
                                  {row.team}
                                </td>
                                <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{row.played}</td>
                                <td style={{ textAlign: 'center', color: row.gd > 0 ? 'var(--accent-green)' : row.gd < 0 ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                                  {row.gd > 0 ? `+${row.gd}` : row.gd}
                                </td>
                                <td style={{ textAlign: 'center', fontWeight: 700, color: isTop2 ? 'var(--accent-green)' : 'var(--text-primary)' }}>{row.points}</td>
                              </tr>
                            );
                          })}
                          {standings.length === 0 && (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>
                                No hay selecciones en este grupo.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sub-tab Content: Bracket */}
            {visualizeSubTab === "bracket" && (
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ marginBottom: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  💡 Desplaza horizontalmente para ver la progresión completa del cuadro (Dieciseisavos a la Gran Final).
                </div>
                <div className="visualize-bracket-outer">
                  <div className="visualize-bracket-container">
                    
                    {/* Column 1: Dieciseisavos (Round of 32) */}
                    <div className="bracket-column">
                      <div className="bracket-round-header">Dieciseisavos</div>
                      {["match_74", "match_77", "match_73", "match_75", "match_83", "match_84", "match_81", "match_82", "match_76", "match_78", "match_79", "match_80", "match_86", "match_88", "match_85", "match_87"].map(matchId => {
                        return renderBracketMatch(matchId);
                      })}
                    </div>

                    {/* Column 2: Octavos (Round of 16) */}
                    <div className="bracket-column">
                      <div className="bracket-round-header">Octavos</div>
                      {["match_89", "match_90", "match_93", "match_94", "match_91", "match_92", "match_95", "match_96"].map(matchId => {
                        return renderBracketMatch(matchId);
                      })}
                    </div>

                    {/* Column 3: Cuartos (Quarter-finals) */}
                    <div className="bracket-column">
                      <div className="bracket-round-header">Cuartos</div>
                      {["match_97", "match_98", "match_99", "match_100"].map(matchId => {
                        return renderBracketMatch(matchId);
                      })}
                    </div>

                    {/* Column 4: Semifinales */}
                    <div className="bracket-column">
                      <div className="bracket-round-header">Semifinales</div>
                      {["match_101", "match_102"].map(matchId => {
                        return renderBracketMatch(matchId);
                      })}
                    </div>

                    {/* Column 5: Finales (Gran Final & 3º Puesto) */}
                    <div className="bracket-column" style={{ justifyContent: 'center', gap: '80px' }}>
                      <div>
                        <div className="bracket-round-header" style={{ background: 'rgba(255, 183, 3, 0.1)', borderColor: 'var(--accent-gold)' }}>Gran Final</div>
                        {renderBracketMatch("match_104")}
                      </div>
                      <div>
                        <div className="bracket-round-header">Tercer Puesto</div>
                        {renderBracketMatch("match_103")}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LEADERBOARD STANDINGS */}
        {activeTab === "leaderboard" && (
          <div className="glass-panel animate-fade-in" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Trophy size={28} style={{ color: 'var(--accent-gold)' }} />
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Tabla de Clasificación</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Resultados actualizados en tiempo real</p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px', textAlign: 'center' }}>Pos</th>
                    <th>Competidor</th>
                    <th style={{ textAlign: 'center' }}>Exactos (3 Pts)</th>
                    <th style={{ textAlign: 'center' }}>Ganador/Empate (1 Pt)</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Puntos Totales</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, index) => {
                    const isSelf = row.uid === user.uid;
                    const rank = index + 1;
                    
                    return (
                      <tr key={row.uid} className={`leaderboard-row ${isSelf ? 'current-user' : ''}`}>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`rank-number ${rank <= 3 ? `rank-${rank}` : ''}`} style={{ border: rank > 3 ? '1px solid var(--border-color)' : 'none' }}>
                            {rank}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, color: isSelf ? '#00e5ff' : 'var(--text-primary)' }}>
                              {row.displayName}
                            </span>
                            {isSelf && <span style={{ fontSize: '0.7rem', background: 'rgba(0, 229, 255, 0.1)', color: '#00e5ff', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>Tú</span>}
                            {row.isAdmin && <Shield size={12} style={{ color: 'var(--accent-gold)' }} title="Administrador" />}
                          </div>
                          {isSelf && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.email}</span>}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 500 }}>{row.exactMatches || 0}</td>
                        <td style={{ textAlign: 'center', fontWeight: 500 }}>{row.correctOutcomes || 0}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge badge-green" style={{ fontSize: '1rem', padding: '4px 12px', fontWeight: 700 }}>
                            {row.totalPoints || 0}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {leaderboard.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                        Cargando clasificación...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ADMIN PANEL */}
        {activeTab === "admin" && userProfile?.isAdmin && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Admin Header */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', borderLeft: '4px solid var(--accent-gold)' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield style={{ color: 'var(--accent-gold)' }} /> Panel de Control Administrativo
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                  Actualiza los marcadores reales de los partidos del Mundial. Al guardar, el sistema recalculará los puntos de todos los usuarios de forma automática.
                </p>
              </div>

              <button 
                onClick={handleSeedDatabase}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '10px 16px', border: '1px solid rgba(255, 183, 3, 0.25)', color: 'var(--accent-gold)' }}
              >
                Sembrar Calendario
              </button>
            </div>

            {/* Configuración de Acceso */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} style={{ color: 'var(--accent-blue)' }} /> Configuración de Acceso
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', display: 'block' }}>Lista blanca de correos (Whitelist)</span>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', lineHeight: '1.4' }}>
                    Si está activada, solo los correos registrados en la base de datos de whitelist podrán registrarse e iniciar sesión. Si está desactivada, cualquier persona podrá unirse.
                  </p>
                </div>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={settings.whitelistEnabled}
                    onChange={async (e) => {
                      const newValue = e.target.checked;
                      try {
                        await setDoc(doc(db, "config", "settings"), { whitelistEnabled: newValue }, { merge: true });
                        setAdminMsg(`Lista blanca ${newValue ? 'activada' : 'desactivada'} correctamente.`);
                        setTimeout(() => setAdminMsg(""), 3000);
                      } catch (err) {
                        console.error("Error al actualizar la configuración:", err);
                        setAdminMsg("Error al actualizar la configuración.");
                        setTimeout(() => setAdminMsg(""), 3000);
                      }
                    }}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            {/* Recalculating Overlay Alert */}
            {recalculating && (
              <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255, 183, 3, 0.1)', borderColor: 'rgba(255, 183, 3, 0.3)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <RefreshCw size={20} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--accent-gold)' }} />
                <span style={{ fontWeight: 600, color: 'var(--accent-gold)' }}>{adminMsg}</span>
              </div>
            )}

            {adminMsg && !recalculating && (
              <div className="glass-panel" style={{ padding: '20px', background: 'rgba(0, 255, 135, 0.1)', borderColor: 'rgba(0, 255, 135, 0.3)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircle2 size={20} style={{ color: 'var(--accent-green)' }} />
                <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{adminMsg}</span>
              </div>
            )}

            {/* Matches list for Score entry */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Lista de Partidos</h3>
              
              {matches.map((match) => {
                const scores = adminScores[match.id] || { homeScore: "", awayScore: "" };
                const isFinished = match.status === "finished";

                return (
                  <div key={match.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span className="badge badge-gray">{match.stage}</span>
                      <span>
                        {new Date(match.date).toLocaleString('es-ES', { 
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                        })}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                      {/* Home */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 180px' }}>
                        <div className="team-logo-placeholder" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                          {match.homeTeam.substring(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{match.homeTeam}</span>
                      </div>

                      {/* Inputs */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input 
                          type="number"
                          min="0"
                          placeholder="-"
                          className="score-input"
                          style={{ width: '44px', height: '44px', fontSize: '1.2rem', borderColor: isFinished ? 'var(--accent-green)' : 'var(--border-color)' }}
                          value={scores.homeScore}
                          onChange={(e) => handleAdminScoreChange(match.id, "homeScore", e.target.value)}
                        />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>VS</span>
                        <input 
                          type="number"
                          min="0"
                          placeholder="-"
                          className="score-input"
                          style={{ width: '44px', height: '44px', fontSize: '1.2rem', borderColor: isFinished ? 'var(--accent-green)' : 'var(--border-color)' }}
                          value={scores.awayScore}
                          onChange={(e) => handleAdminScoreChange(match.id, "awayScore", e.target.value)}
                        />
                      </div>

                      {/* Away */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', flex: '1 1 180px', textAlign: 'right' }}>
                        <span>{match.awayTeam}</span>
                        <div className="team-logo-placeholder" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                          {match.awayTeam.substring(0, 2).toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                      <span style={{ fontSize: '0.8rem', color: isFinished ? 'var(--accent-green)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {isFinished ? "✓ Resultado Publicado" : "Resultado Pendiente"}
                      </span>

                      <button
                        onClick={() => handleSaveResult(match.id)}
                        disabled={recalculating}
                        className={`btn ${isFinished ? 'btn-secondary' : 'btn-accent'}`}
                        style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem' }}
                      >
                        <Save size={13} />
                        <span>{isFinished ? "Actualizar Resultado" : "Publicar y Recalcular"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {matches.length === 0 && (
                <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No hay partidos sembrados. Haz clic en "Sembrar Calendario" arriba para inicializar.
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '24px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <span>Porra del Mundial 2026 - Creado para jugar en grupo</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Powered by Firebase & React
          </span>
        </div>
      </footer>

      {/* Floating Back-to-Top Button */}
      {showScrollTop && (
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--bg-tertiary)',
            border: '2px solid var(--border-color)',
            color: 'var(--accent-green)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            cursor: 'pointer',
            zIndex: 1000,
            transition: 'all 0.2s ease',
            opacity: 0.95
          }}
          title="Volver arriba"
        >
          <ChevronUp size={24} />
        </button>
      )}

    </div>
  );
}

export default App;
