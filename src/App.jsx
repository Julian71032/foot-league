import React, { useState, useEffect } from 'react';

const API_URL = 'https://serveur-ligue.onrender.com/api';
const ADMIN_EMAIL = 'belnezjulian2@gmail.com';

// --- LISTE DES POSTES ---
const POSITIONS_LIST = [
  { label: '-- GARDIENS --', disabled: true },
  { value: 'G', label: 'G - Gardien' },
  { label: '-- DÉFENSEURS --', disabled: true },
  { value: 'DC', label: 'DC - Défenseur Central' },
  { value: 'DD', label: 'DD - Défenseur Droit' },
  { value: 'DG', label: 'DG - Défenseur Gauche' },
  { value: 'DLD', label: 'DLD - Piston Droit' },
  { value: 'DLG', label: 'DLG - Piston Gauche' },
  { label: '-- MILIEUX --', disabled: true },
  { value: 'MDC', label: 'MDC - Milieu Défensif Central' },
  { value: 'MC', label: 'MC - Milieu Central' },
  { value: 'MOC', label: 'MOC - Milieu Offensif Central' },
  { value: 'MD', label: 'MD - Milieu Droit' },
  { value: 'MG', label: 'MG - Milieu Gauche' },
  { label: '-- ATTAQUANTS --', disabled: true },
  { value: 'BU', label: 'BU - Buteur' },
  { value: 'AT', label: 'AT - Attaquant' },
  { value: 'AD', label: 'AD - Ailier Droit' },
  { value: 'AG', label: 'AG - Ailier Gauche' },
  { value: 'SA', label: 'SA - Second Attaquant' }
];

const POSITION_ORDER = {
  'G': 0,
  'DC': 1, 'DD': 2, 'DG': 3, 'DLD': 4, 'DLG': 4,
  'MDC': 5, 'MC': 6, 'MOC': 7, 'MD': 8, 'MG': 8,
  'AD': 9, 'AG': 10, 'SA': 11, 'BU': 12, 'AT': 12
};

function getPositionRank(posteStr) {
  if (!posteStr) return 99;
  const code = posteStr.split(' - ')[0].trim().toUpperCase();
  return POSITION_ORDER[code] ?? 99;
}

function getSeasonLabel(seasonNum) {
  const startYear = 2026 + (parseInt(seasonNum, 10) - 1);
  return `Saison ${seasonNum} (${startYear}/${startYear + 1})`;
}

function calculateMarketValue(gen, age) {
  const g = Math.max(45, Math.min(99, gen || 75));
  const a = Math.max(15, Math.min(45, age || 24));

  let baseValue = Math.pow(g / 45, 6.2) * 500000;

  let ageMultiplier = 1.0;
  if (a <= 21) ageMultiplier = 1.45;
  else if (a <= 24) ageMultiplier = 1.25;
  else if (a <= 28) ageMultiplier = 1.05;
  else if (a <= 31) ageMultiplier = 0.85;
  else if (a <= 34) ageMultiplier = 0.55;
  else ageMultiplier = 0.30;

  let finalVal = baseValue * ageMultiplier;

  if (finalVal > 20000000) finalVal = Math.round(finalVal / 1000000) * 1000000;
  else if (finalVal > 5000000) finalVal = Math.round(finalVal / 500000) * 500000;
  else finalVal = Math.round(finalVal / 100000) * 100000;

  return Math.max(250000, finalVal);
}

function generateInjuryDuration() {
  const roll = Math.random() * 100;
  if (roll < 50) return { label: '1 match', matches: 1 };
  if (roll < 80) return { label: `${Math.floor(Math.random() * 2) + 2} matchs`, matches: Math.floor(Math.random() * 2) + 2 };
  if (roll < 94) return { label: `${Math.floor(Math.random() * 3) + 4} matchs`, matches: Math.floor(Math.random() * 3) + 4 };
  if (roll < 99) return { label: `${Math.floor(Math.random() * 6) + 7} matchs`, matches: Math.floor(Math.random() * 6) + 7 };
  return { label: 'Fin de saison', matches: 38 };
}

// --- MOTEUR DE GESTION DES INDISPONIBILITÉS (BLESSURES + ROUGES + ACCUMULATION DE JAUNES) ---
function getPlayerStatusAt(playerId, targetJournee, targetSeason, eventsList) {
  const currentJ = parseInt(targetJournee, 10) || 1;
  const currentS = parseInt(targetSeason, 10) || 1;

  const playerEvents = eventsList.filter(
    e => String(e.player_id) === String(playerId) && (parseInt(e.saison, 10) || 1) === currentS
  );

  // 1. Vérification des blessures
  const injuries = playerEvents.filter(e => e.type === 'blessure');
  for (const inj of injuries) {
    const startJ = parseInt(inj.journee, 10) || 1;
    const duration = parseInt(inj.duration_matches, 10) || 1;
    if (currentJ >= startJ && currentJ < startJ + duration) {
      const remaining = (startJ + duration) - currentJ;
      return {
        available: false,
        type: 'blessure',
        remaining,
        badgeText: `🚑 Blessé (${remaining} m.)`,
        badgeClass: 'bg-rose-600/20 text-rose-400 border-rose-500/30'
      };
    }
  }

  // 2. Vérification des cartons rouges directs (1 match de suspension automatique pour le match suivant)
  const redCards = playerEvents.filter(e => e.type === 'carton_rouge');
  for (const red of redCards) {
    const redJ = parseInt(red.journee, 10) || 1;
    if (currentJ === redJ + 1) {
      return {
        available: false,
        type: 'rouge',
        remaining: 1,
        badgeText: '🟥 Suspendu (Rouge)',
        badgeClass: 'bg-red-600/20 text-red-400 border-red-500/40'
      };
    }
  }

  // 3. Vérification de l'accumulation des cartons jaunes (3 jaunes sur 10 journées glissantes = 1 match de suspension)
  const yellowCards = playerEvents
    .filter(e => e.type === 'carton_jaune')
    .map(e => parseInt(e.journee, 10) || 1)
    .sort((a, b) => a - b);

  let suspendedJournees = new Set();
  let currentWindow = [];

  for (const j of yellowCards) {
    currentWindow = currentWindow.filter(pastJ => j - pastJ <= 10);
    currentWindow.push(j);

    if (currentWindow.length >= 3) {
      suspendedJournees.add(j + 1);
      currentWindow = [];
    }
  }

  if (suspendedJournees.has(currentJ)) {
    return {
      available: false,
      type: 'jaunes',
      remaining: 1,
      badgeText: '🟨 Suspendu (3 Jaunes)',
      badgeClass: 'bg-amber-600/20 text-amber-400 border-amber-500/40'
    };
  }

  return {
    available: true,
    type: 'ok',
    remaining: 0,
    badgeText: '✓ Disponible',
    badgeClass: 'text-emerald-400'
  };
}

function compressImage(file, maxSize = 128) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png', 0.8));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

const FORMATIONS = {
  '4-3-3': { name: '4-3-3 (Classique)', def: 4, mid: 3, att: 3 },
  '4-4-2': { name: '4-4-2 (Équilibré)', def: 4, mid: 4, att: 2 },
  '4-2-3-1': { name: '4-2-3-1 (Offensif)', def: 4, mid: 5, att: 1 },
  '3-5-2': { name: '3-5-2 (Pistons)', def: 3, mid: 5, att: 2 },
  '5-4-1': { name: '5-4-1 (Défensif)', def: 5, mid: 4, att: 1 },
  '3-4-3': { name: '3-4-3 (Ultra-Offensif)', def: 3, mid: 4, att: 3 }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [tab, setTab] = useState('classement');
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [matchEvents, setMatchEvents] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [seasonFilter, setSeasonFilter] = useState(1);
  const [journeeFilter, setJourneeFilter] = useState(1);
  const [notification, setNotification] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [loading, setLoading] = useState(true);

  const [seasonEvolutions, setSeasonEvolutions] = useState({});

  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedMatchEvents, setSelectedMatchEvents] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);

  const [evolutionReport, setEvolutionReport] = useState(null);
  const [mercatoReport, setMercatoReport] = useState(null);

  const [editingTeamLogo, setEditingTeamLogo] = useState(null);
  const [newLogoFile, setNewLogoFile] = useState(null);
  const [logoUpdating, setLogoUpdating] = useState(false);

  const [selectedLineupTeam, setSelectedLineupTeam] = useState(null);
  const [currentFormation, setCurrentFormation] = useState('4-3-3');
  const [teamLineupPlayers, setTeamLineupPlayers] = useState([]);
  const [teamBenchPlayers, setTeamBenchPlayers] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [savingLineup, setSavingLineup] = useState(false);

  const [scoresInput, setScoresInput] = useState({});
  const [newTeamName, setNewTeamName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ nom: '', equipe_id: '', numero: 10, general: 75, valeur: 10000000, age: 22, poste: 'MC' });

  const [transferFromTeamId, setTransferFromTeamId] = useState('');
  const [transferPlayerId, setTransferPlayerId] = useState('');
  const [transferToTeamId, setTransferToTeamId] = useState('');
  const [transferFee, setTransferFee] = useState(10000000);
  const [transferType, setTransferType] = useState('achat');
  const [transferLoading, setTransferLoading] = useState(false);

  const isAdmin = currentUser?.email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }

    const savedUser = localStorage.getItem('session_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchUserData(currentUser.email);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!loading && currentUser && teams.length > 0) {
      const uKey = currentUser.email;
      try {
        localStorage.setItem(`local_teams_${uKey}`, JSON.stringify(teams));
      } catch (e) {}
    }
  }, [teams, loading, currentUser]);

  useEffect(() => {
    if (!loading && currentUser && players.length > 0) {
      const uKey = currentUser.email;
      try {
        localStorage.setItem(`local_players_${uKey}`, JSON.stringify(players));
      } catch (e) {}
    }
  }, [players, loading, currentUser]);

  useEffect(() => {
    if (!loading && currentUser && matches.length > 0) {
      const uKey = currentUser.email;
      try {
        localStorage.setItem(`local_matches_${uKey}`, JSON.stringify(matches));
      } catch (e) {}
    }
  }, [matches, loading, currentUser]);

  useEffect(() => {
    if (!loading && currentUser) {
      const uKey = currentUser.email;
      try {
        localStorage.setItem(`local_events_${uKey}`, JSON.stringify(matchEvents));
      } catch (e) {}
    }
  }, [matchEvents, loading, currentUser]);

  useEffect(() => {
    if (!loading && currentUser) {
      const uKey = currentUser.email;
      try {
        localStorage.setItem(`local_transfers_${uKey}`, JSON.stringify(transfers));
      } catch (e) {}
    }
  }, [transfers, loading, currentUser]);

  function showNotif(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4500);
  }

  function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError('');
    const cleanEmail = authEmail.trim().toLowerCase();
    const users = JSON.parse(localStorage.getItem('app_registered_users') || '{}');

    if (authMode === 'register') {
      if (users[cleanEmail]) {
        setAuthError('Ce courriel possède déjà un compte.');
        return;
      }
      users[cleanEmail] = { email: cleanEmail, password: authPassword };
      localStorage.setItem('app_registered_users', JSON.stringify(users));
      const userObj = { email: cleanEmail };
      localStorage.setItem('session_user', JSON.stringify(userObj));
      setCurrentUser(userObj);
      showNotif(`Compte créé avec succès ! Bienvenue ${cleanEmail}`);
    } else {
      const user = users[cleanEmail];
      if (!user || user.password !== authPassword) {
        setAuthError('Courriel ou mot de passe incorrect.');
        return;
      }
      const userObj = { email: cleanEmail };
      localStorage.setItem('session_user', JSON.stringify(userObj));
      setCurrentUser(userObj);
      showNotif(`Bon retour ${cleanEmail} !`);
    }
  }

  function handleLogout() {
    localStorage.removeItem('session_user');
    setCurrentUser(null);
    setTeams([]);
    setPlayers([]);
    setMatches([]);
    setMatchEvents([]);
    setTransfers([]);
    setTab('classement');
  }

  function handleSaveTournamentProgress() {
    if (!currentUser) return;
    setSavingProgress(true);
    const uKey = currentUser.email;
    localStorage.setItem(`local_season_${uKey}`, seasonFilter);
    localStorage.setItem(`local_journee_${uKey}`, journeeFilter);
    showNotif(`Progression sauvegardée ! Reprise à la Journée ${journeeFilter} (${getSeasonLabel(seasonFilter)})`);
    setSavingProgress(false);
  }

  function buildRoundRobinFixtures(allTeams, userId, seasonNum) {
    if (!allTeams || allTeams.length < 2) return [];

    const list = [...allTeams].sort(() => Math.random() - 0.5);
    let n = list.length;
    if (n % 2 !== 0) {
      list.push(null);
      n++;
    }

    const numRounds = n - 1;
    const half = n / 2;
    const allerMatches = [];

    for (let round = 0; round < numRounds; round++) {
      const journee = round + 1;
      for (let i = 0; i < half; i++) {
        const t1 = list[i];
        const t2 = list[n - 1 - i];

        if (t1 !== null && t2 !== null) {
          let home = (round + i) % 2 === 0 ? t1 : t2;
          let away = (round + i) % 2 === 0 ? t2 : t1;

          if (i === 0) {
            home = round % 2 === 0 ? t1 : t2;
            away = round % 2 === 0 ? t2 : t1;
          }

          allerMatches.push({
            id: `${seasonNum}-${journee}-${home.id}-${away.id}`,
            equipe_domicile_id: home.id,
            equipe_exterieur_id: away.id,
            journee: journee,
            saison: seasonNum,
            statut: 'à venir',
            user_id: userId
          });
        }
      }

      const fixed = list[0];
      const rest = list.slice(1);
      const last = rest.pop();
      rest.unshift(last);
      list.splice(0, list.length, fixed, ...rest);
    }

    const retourMatches = allerMatches.map(m => ({
      id: `${seasonNum}-${m.journee + numRounds}-${m.equipe_exterieur_id}-${m.equipe_domicile_id}`,
      equipe_domicile_id: m.equipe_exterieur_id,
      equipe_exterieur_id: m.equipe_domicile_id,
      journee: m.journee + numRounds,
      saison: seasonNum,
      statut: 'à venir',
      user_id: userId
    }));

    return [...allerMatches, ...retourMatches];
  }

  function handleGenerateCurrentSchedule() {
    if (!teams || teams.length < 2) {
      alert("Il vous faut au moins 2 équipes pour générer un calendrier.");
      return;
    }
    const uKey = currentUser?.email || 'local_user';
    const s = parseInt(seasonFilter, 10) || 1;
    const newFixtures = buildRoundRobinFixtures(teams, uKey, s);
    const otherSeasonMatches = matches.filter(m => (m.saison || 1) !== s);
    const fullMatches = [...otherSeasonMatches, ...newFixtures];
    
    setMatches(fullMatches);
    localStorage.setItem(`local_matches_${uKey}`, JSON.stringify(fullMatches));
    setJourneeFilter(1);
    localStorage.setItem(`local_journee_${uKey}`, 1);
    showNotif(`Calendrier généré : ${newFixtures.length} matchs programmés pour la Saison ${s} !`);
  }

  async function fetchUserData(userEmail) {
    setLoading(true);
    try {
      const uKey = userEmail;
      let localTeams = null;
      let localPlayers = null;
      let localMatches = null;
      let localEvents = null;
      let localTransfers = null;

      try {
        localTeams = JSON.parse(localStorage.getItem(`local_teams_${uKey}`));
        localPlayers = JSON.parse(localStorage.getItem(`local_players_${uKey}`));
        localMatches = JSON.parse(localStorage.getItem(`local_matches_${uKey}`));
        localEvents = JSON.parse(localStorage.getItem(`local_events_${uKey}`));
        localTransfers = JSON.parse(localStorage.getItem(`local_transfers_${uKey}`));
      } catch (e) {
        console.error("Cache local ignoré.");
      }

      let currentTeams = Array.isArray(localTeams) ? localTeams : [];
      let currentPlayers = Array.isArray(localPlayers) ? localPlayers : [];
      let currentMatches = Array.isArray(localMatches) ? localMatches : [];
      let currentEvents = Array.isArray(localEvents) ? localEvents : [];
      let currentTransfers = Array.isArray(localTransfers) ? localTransfers : [];

      if (currentTeams.length === 0 || currentPlayers.length === 0) {
        const [resTeams, resPlayers] = await Promise.all([
          fetch(`${API_URL}/teams`).then(r => r.json()).catch(() => []),
          fetch(`${API_URL}/players`).then(r => r.json()).catch(() => [])
        ]);

        currentTeams = Array.isArray(resTeams) ? resTeams : [];
        currentPlayers = Array.isArray(resPlayers) ? resPlayers : [];
        currentMatches = buildRoundRobinFixtures(currentTeams, uKey, 1);

        try {
          localStorage.setItem(`local_teams_${uKey}`, JSON.stringify(currentTeams));
          localStorage.setItem(`local_players_${uKey}`, JSON.stringify(currentPlayers));
          localStorage.setItem(`local_matches_${uKey}`, JSON.stringify(currentMatches));
          localStorage.setItem(`local_events_${uKey}`, JSON.stringify([]));
          localStorage.setItem(`local_transfers_${uKey}`, JSON.stringify([]));
        } catch(e) {}
      }

      if (currentMatches.length === 0 && currentTeams.length >= 2) {
        currentMatches = buildRoundRobinFixtures(currentTeams, uKey, 1);
        try {
          localStorage.setItem(`local_matches_${uKey}`, JSON.stringify(currentMatches));
        } catch(e) {}
      }

      setTeams(currentTeams);
      setPlayers(currentPlayers);
      setMatches(currentMatches);
      setMatchEvents(currentEvents);
      setTransfers(currentTransfers);

      const maxS = currentMatches.length > 0 ? Math.max(...currentMatches.map(m => m.saison || 1), 1) : 1;
      const savedSeason = localStorage.getItem(`local_season_${uKey}`);
      const savedJournee = localStorage.getItem(`local_journee_${uKey}`);

      const activeSeason = savedSeason ? parseInt(savedSeason, 10) : maxS;
      setSeasonFilter(activeSeason);

      if (savedJournee) {
        setJourneeFilter(parseInt(savedJournee, 10));
      } else {
        const firstUnfinished = currentMatches.find(
          m => m.statut !== 'terminé' && (m.saison || 1) === activeSeason
        );
        if (firstUnfinished) {
          setJourneeFilter(firstUnfinished.journee || 1);
        }
      }
    } catch (err) {
      console.error('Erreur chargement:', err);
    } finally {
      setLoading(false);
    }
  }

  const getSortedTeamPlayers = (teamId) => {
    if (!teamId) return [];
    return playersWithStats
      .filter(p => String(p.equipe_id) === String(teamId))
      .sort((a, b) => {
        const rankA = getPositionRank(a.poste);
        const rankB = getPositionRank(b.poste);
        if (rankA !== rankB) return rankA - rankB;
        return (b.general || 0) - (a.general || 0);
      });
  };

  // Exclut de manière stricte les blessés et suspendus de la compo et du banc
  function getTeamStartersAndBench(team, targetJournee = journeeFilter) {
    if (!team) return { starters: [], bench: [], unavailable: [] };
    const all = getSortedTeamPlayers(team.id);
    const currentS = parseInt(seasonFilter, 10) || 1;
    const targetJ = parseInt(targetJournee, 10) || 1;

    const available = all.filter(p => getPlayerStatusAt(p.id, targetJ, currentS, matchEvents).available);
    const unavailable = all.filter(p => !getPlayerStatusAt(p.id, targetJ, currentS, matchEvents).available);

    let savedIds = team.lineup_ids;
    if (typeof savedIds === 'string') {
      try { savedIds = JSON.parse(savedIds); } catch (e) { savedIds = []; }
    }

    if (Array.isArray(savedIds) && savedIds.length >= 11) {
      const map = new Map(available.map(p => [p.id, p]));
      const starters = savedIds.map(id => map.get(id)).filter(Boolean);
      const starterSet = new Set(starters.map(p => p.id));
      const bench = available.filter(p => !starterSet.has(p.id));

      if (starters.length >= 11) {
        return { starters: starters.slice(0, 11), bench, unavailable };
      }
    }

    return { starters: available.slice(0, 11), bench: available.slice(11), unavailable };
  }

  async function triggerAutomatedMercato(journeeNum, currentSeasonNum, maxTransfers = 4, isSummer = false) {
    if (!teams || teams.length < 2 || !players || players.length < 10) return;

    const teamCounts = {};
    teams.forEach(t => {
      teamCounts[t.id] = players.filter(p => String(p.equipe_id) === String(t.id)).length;
    });

    const rankedTeams = [...classement];
    const topClubs = rankedTeams.slice(0, Math.max(1, Math.floor(rankedTeams.length * 0.35)));
    const midClubs = rankedTeams.slice(Math.floor(rankedTeams.length * 0.35), Math.floor(rankedTeams.length * 0.70));
    const bottomClubs = rankedTeams.slice(Math.floor(rankedTeams.length * 0.70));

    const availablePool = [...players].sort(() => Math.random() - 0.5);
    const completedTransfers = [];
    const usedPlayerIds = new Set();
    const updatedPlayers = [...players];
    const newTransfersList = [...transfers];
    const updatedTeamsList = [...teams];

    for (const player of availablePool) {
      if (completedTransfers.length >= maxTransfers) break;
      if (usedPlayerIds.has(player.id)) continue;

      const currentGen = player.general || 75;
      const age = player.age || 24;
      const originTeamId = player.equipe_id;
      const originTeam = teams.find(t => String(t.id) === String(originTeamId));
      if (!originTeam) continue;

      if ((teamCounts[originTeamId] || 0) <= 16) continue;

      let destinationTeam = null;
      let reason = '';
      let isLoan = false;

      const canBuy = (club) => String(club.id) !== String(originTeamId) && (teamCounts[club.id] || 0) < 28;

      if (currentGen >= 83 || (age <= 22 && currentGen >= 78)) {
        const candidateDest = topClubs.filter(canBuy);
        if (candidateDest.length > 0) {
          destinationTeam = candidateDest[Math.floor(Math.random() * candidateDest.length)];
          reason = currentGen >= 83 ? "Transfert galactique vers un cador" : "Signature d'une pépite d'or mondiale";
        }
      } else if (currentGen >= 77) {
        const candidateDest = [...topClubs, ...midClubs].filter(canBuy);
        if (candidateDest.length > 0) {
          destinationTeam = candidateDest[Math.floor(Math.random() * candidateDest.length)];
          reason = "Renfort majeur dans l'entrejeu/attaque";
        }
      } else if (age <= 22 && Math.random() < 0.65) {
        const candidateDest = [...midClubs, ...bottomClubs].filter(canBuy);
        if (candidateDest.length > 0) {
          destinationTeam = candidateDest[Math.floor(Math.random() * candidateDest.length)];
          isLoan = true;
          reason = "Prêt d'un an pour s'aguerrir et gagner du temps de jeu";
        }
      } else {
        const candidateDest = [...bottomClubs, ...midClubs].filter(canBuy);
        if (candidateDest.length > 0) {
          destinationTeam = candidateDest[Math.floor(Math.random() * candidateDest.length)];
          reason = "Recherche de temps de jeu et maintien";
        }
      }

      if (destinationTeam) {
        usedPlayerIds.add(player.id);
        const fee = isLoan ? 0 : (player.valeur_marchande || calculateMarketValue(currentGen, age));

        teamCounts[originTeamId]--;
        teamCounts[destinationTeam.id]++;

        const pIdx = updatedPlayers.findIndex(p => p.id === player.id);
        if (pIdx !== -1) {
          updatedPlayers[pIdx] = {
            ...updatedPlayers[pIdx],
            equipe_id: destinationTeam.id,
            teams: destinationTeam,
            is_loan: isLoan,
            loan_parent_id: isLoan ? (player.loan_parent_id || originTeamId) : null
          };
        }

        const oldTeamIdx = updatedTeamsList.findIndex(t => String(t.id) === String(originTeamId));
        if (oldTeamIdx !== -1 && updatedTeamsList[oldTeamIdx].lineup_ids) {
          let lineIds = updatedTeamsList[oldTeamIdx].lineup_ids;
          if (typeof lineIds === 'string') {
            try { lineIds = JSON.parse(lineIds); } catch (e) { lineIds = []; }
          }
          if (Array.isArray(lineIds)) {
            updatedTeamsList[oldTeamIdx].lineup_ids = lineIds.filter(id => id !== player.id);
          }
        }

        const newTr = {
          id: Date.now() + Math.random(),
          player_id: player.id,
          old_team_id: originTeam.id,
          new_team_id: destinationTeam.id,
          fee: fee,
          type: isLoan ? 'pret' : 'achat',
          user_id: currentUser?.email || 'local_user',
          players: player,
          old_team: originTeam,
          new_team: destinationTeam
        };

        newTransfersList.unshift(newTr);

        completedTransfers.push({
          id: player.id,
          nom: player.nom,
          poste: player.poste,
          general: currentGen,
          age: age,
          oldTeam: originTeam.nom,
          newTeam: destinationTeam.nom,
          fee: fee,
          type: isLoan ? 'Prêt (1 an)' : 'Achat',
          reason: reason
        });
      }
    }

    if (completedTransfers.length > 0) {
      setPlayers(updatedPlayers);
      setTeams(updatedTeamsList);
      setTransfers(newTransfersList);
      setMercatoReport({
        isSummer,
        title: isSummer ? "MERCATO ESTIVAL" : "MERCATO D'HIVER",
        journee: journeeNum,
        seasonLabel: getSeasonLabel(currentSeasonNum),
        transfers: completedTransfers
      });
    }
  }

  async function evaluateAndApplyPlayerEvolutions(targetJournee, currentSeasonNum) {
    const startJournee = targetJournee - 3;
    const endJournee = targetJournee;

    const blockMatches = matches.filter(
      m => (m.saison || 1) === currentSeasonNum && m.journee >= startJournee && m.journee <= endJournee && m.statut === 'terminé'
    );
    const blockMatchIds = new Set(blockMatches.map(m => m.id));

    const blockEvents = matchEvents.filter(
      e => (e.saison || 1) === currentSeasonNum && blockMatchIds.has(e.match_id)
    );

    const teamRecords = {};
    teams.forEach(t => {
      teamRecords[t.id] = { wins: 0, losses: 0, draws: 0, goalsConceded: 0, cleanSheets: 0, matchCount: 0 };
    });

    blockMatches.forEach(m => {
      if (teamRecords[m.equipe_domicile_id]) {
        teamRecords[m.equipe_domicile_id].matchCount++;
        teamRecords[m.equipe_domicile_id].goalsConceded += (m.score_exterieur || 0);
        if (m.score_exterieur === 0) teamRecords[m.equipe_domicile_id].cleanSheets++;
        if (m.score_domicile > m.score_exterieur) teamRecords[m.equipe_domicile_id].wins++;
        else if (m.score_domicile < m.score_exterieur) teamRecords[m.equipe_domicile_id].losses++;
        else teamRecords[m.equipe_domicile_id].draws++;
      }
      if (teamRecords[m.equipe_exterieur_id]) {
        teamRecords[m.equipe_exterieur_id].matchCount++;
        teamRecords[m.equipe_exterieur_id].goalsConceded += (m.score_domicile || 0);
        if (m.score_domicile === 0) teamRecords[m.equipe_exterieur_id].cleanSheets++;
        if (m.score_exterieur > m.score_domicile) teamRecords[m.equipe_exterieur_id].wins++;
        else if (m.score_exterieur < m.score_domicile) teamRecords[m.equipe_exterieur_id].losses++;
        else teamRecords[m.equipe_exterieur_id].draws++;
      }
    });

    const currentSeasonMap = { ...(seasonEvolutions[currentSeasonNum] || {}) };
    const candidates = [];

    for (const player of players) {
      const currentGen = player.general || 75;
      const currentVal = player.valeur_marchande || 10000000;
      const age = player.age || 24;
      const pos = player.poste || 'MC';

      const pEvents = blockEvents.filter(e => String(e.player_id) === String(player.id));
      const buts = pEvents.filter(e => e.type === 'but').length;
      const passes = pEvents.filter(e => e.type === 'passe').length;
      const redCards = pEvents.filter(e => e.type === 'carton_rouge').length;
      const yellowCards = pEvents.filter(e => e.type === 'carton_jaune').length;

      const tRec = teamRecords[player.equipe_id] || { wins: 0, losses: 0, goalsConceded: 4, cleanSheets: 0, matchCount: 4 };

      let perfScore = 0;

      if (['BU', 'AT', 'AD', 'AG', 'SA'].includes(pos)) {
        perfScore += buts * 3.5;
        perfScore += passes * 2.0;
        perfScore += (tRec.wins * 0.8) - (tRec.losses * 0.8);
      } else if (['MOC', 'MC', 'MD', 'MG'].includes(pos)) {
        perfScore += buts * 3.0;
        perfScore += passes * 2.8;
        perfScore += (tRec.wins * 1.0) - (tRec.losses * 0.8);
      } else if (['MDC', 'DC', 'DD', 'DG', 'DLD', 'DLG'].includes(pos)) {
        perfScore += buts * 4.0;
        perfScore += passes * 2.0;
        perfScore += (tRec.cleanSheets * 2.0);
        perfScore += (tRec.wins * 0.8);
        perfScore -= (tRec.goalsConceded * 0.5);
      } else if (pos === 'G') {
        perfScore += (tRec.cleanSheets * 3.0);
        perfScore += (tRec.wins * 1.0);
        perfScore -= (tRec.goalsConceded * 0.7);
      }

      perfScore -= (redCards * 3.0) + (yellowCards * 0.5);

      let delta = 0;
      if (currentGen >= 88) {
        if (perfScore >= 10.0) delta = +1;
        else if (perfScore <= -3.0) delta = -2;
        else if (perfScore <= 0.0) delta = -1;
      } else if (currentGen >= 82) {
        if (perfScore >= 11.5) delta = +2;
        else if (perfScore >= 7.0) delta = +1;
        else if (perfScore <= -3.5) delta = -2;
        else if (perfScore <= 0.0) delta = -1;
      } else if (currentGen >= 74) {
        if (perfScore >= 10.0) delta = +2;
        else if (perfScore >= 5.0) delta = +1;
        else if (perfScore <= -3.0) delta = -2;
        else if (perfScore <= -0.5) delta = -1;
      } else {
        if (perfScore >= 9.5) delta = +3;
        else if (perfScore >= 6.0) delta = +2;
        else if (perfScore >= 3.0) delta = +1;
        else if (perfScore <= -4.0) delta = -2;
        else if (perfScore <= -1.5) delta = -1;
      }

      delta = Math.max(-3, Math.min(3, delta));
      const currentCumulative = currentSeasonMap[player.id] || 0;
      let allowedDelta = delta;

      if (delta > 0) allowedDelta = Math.min(delta, 3 - currentCumulative);
      else if (delta < 0) allowedDelta = Math.max(delta, -3 - currentCumulative);

      if (allowedDelta !== 0) {
        candidates.push({
          player,
          perfScore,
          absImpact: Math.abs(perfScore),
          delta: allowedDelta,
          currentCumulative,
          currentGen,
          currentVal,
          age,
          buts,
          passes
        });
      }
    }

    const changedPlayers = [];
    const countByTeam = {};
    candidates.sort((a, b) => b.absImpact - a.absImpact);

    const updatedPlayers = [...players];

    for (const c of candidates) {
      const tId = c.player.equipe_id;
      countByTeam[tId] = countByTeam[tId] || 0;

      if (countByTeam[tId] < 3) {
        countByTeam[tId]++;
        const newGen = Math.max(45, Math.min(99, c.currentGen + c.delta));
        const newVal = calculateMarketValue(newGen, c.age);

        currentSeasonMap[c.player.id] = c.currentCumulative + c.delta;

        const pIdx = updatedPlayers.findIndex(p => p.id === c.player.id);
        if (pIdx !== -1) {
          updatedPlayers[pIdx] = { ...updatedPlayers[pIdx], general: newGen, valeur_marchande: newVal };
        }

        changedPlayers.push({
          id: c.player.id,
          nom: c.player.nom,
          teamName: c.player.teams?.nom || 'Club',
          poste: c.player.poste,
          oldGen: c.currentGen,
          newGen: newGen,
          delta: c.delta,
          seasonTotal: currentSeasonMap[c.player.id],
          oldVal: c.currentVal,
          newVal: newVal,
          buts: c.buts,
          passes: c.passes
        });
      }
    }

    setPlayers(updatedPlayers);
    setSeasonEvolutions(prev => ({ ...prev, [currentSeasonNum]: currentSeasonMap }));

    if (changedPlayers.length > 0) {
      setEvolutionReport({
        journeesLabel: `Journées ${startJournee} à ${endJournee}`,
        seasonLabel: getSeasonLabel(currentSeasonNum),
        players: changedPlayers.sort((a, b) => b.delta - a.delta)
      });
    }
  }

  function simulateGoals(lambda) {
    let L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return Math.max(0, k - 1);
  }

  function pickGoalScorer(activePlayers) {
    if (!activePlayers || activePlayers.length === 0) return null;
    
    const outfieldPlayers = activePlayers.filter(p => (p.poste || '').trim().toUpperCase() !== 'G');
    if (outfieldPlayers.length === 0) return null;

    const weighted = outfieldPlayers.map(p => {
      let w = 1;
      const pos = p.poste || 'MC';
      if (['BU', 'AT'].includes(pos)) w = 14;
      else if (['AD', 'AG', 'SA'].includes(pos)) w = 10;
      else if (['MOC', 'MD', 'MG'].includes(pos)) w = 5;
      else if (['MC', 'MDC'].includes(pos)) w = 2.5;
      else if (['DD', 'DG', 'DLD', 'DLG', 'DC'].includes(pos)) w = 1;

      w *= Math.pow((p.general || 75) / 75, 1.5);
      return { player: p, weight: w };
    });

    const totalWeight = weighted.reduce((acc, item) => acc + item.weight, 0);
    let randomVal = Math.random() * totalWeight;
    for (const item of weighted) {
      if (randomVal < item.weight) return item.player;
      randomVal -= item.weight;
    }
    return outfieldPlayers[0];
  }

  function pickAssister(activePlayers, scorer) {
    if (!activePlayers || activePlayers.length < 2) return null;
    const candidates = activePlayers.filter(p => p.id !== scorer?.id && (p.poste || '').trim().toUpperCase() !== 'G');
    if (candidates.length === 0) return null;

    const weighted = candidates.map(p => {
      let w = 1;
      const pos = p.poste || 'MC';
      if (['MOC', 'MC', 'MD', 'MG'].includes(pos)) w = 12;
      else if (['AD', 'AG', 'SA'].includes(pos)) w = 10;
      else if (['DD', 'DG', 'DLD', 'DLG'].includes(pos)) w = 6;
      else if (['BU', 'AT'].includes(pos)) w = 4;
      else if (['MDC', 'DC'].includes(pos)) w = 2;

      w *= (p.general || 75) / 75;
      return { player: p, weight: w };
    });

    const totalWeight = weighted.reduce((acc, item) => acc + item.weight, 0);
    let randomVal = Math.random() * totalWeight;
    for (const item of weighted) {
      if (randomVal < item.weight) return item.player;
      randomVal -= item.weight;
    }
    return candidates[0];
  }

  function pickCardPlayer(activePlayers) {
    if (!activePlayers || activePlayers.length === 0) return null;
    const weighted = activePlayers.map(p => {
      let w = 1;
      const pos = p.poste || 'MC';
      if (['MDC', 'DC'].includes(pos)) w = 8;
      else if (['DD', 'DG', 'DLD', 'DLG', 'MC'].includes(pos)) w = 5;
      else if (['MOC', 'MD', 'MG'].includes(pos)) w = 3;
      else w = 1;
      return { player: p, weight: w };
    });
    const totalWeight = weighted.reduce((acc, item) => acc + item.weight, 0);
    let randomVal = Math.random() * totalWeight;
    for (const item of weighted) {
      if (randomVal < item.weight) return item.player;
      randomVal -= item.weight;
    }
    return activePlayers[0];
  }

  function pickInjuredPlayer(activePlayers) {
    if (!activePlayers || activePlayers.length === 0) return null;
    return activePlayers[Math.floor(Math.random() * activePlayers.length)];
  }

  function handleRollDice(matchId) {
    const diceDom = Math.floor(Math.random() * 7);
    const diceExt = Math.floor(Math.random() * 7);

    setScoresInput(prev => ({
      ...prev,
      [matchId]: { dom: diceDom, ext: diceExt }
    }));
    showNotif(`🎲 Lancer de dé : ${diceDom} - ${diceExt}`);
  }

  function generateMatchEventsForCustomScore(m, domTeam, extTeam, scoreDom, scoreExt, seasonNum, userId) {
    const { starters: domStarters, bench: domBench } = getTeamStartersAndBench(domTeam, m.journee);
    const { starters: extStarters, bench: extBench } = getTeamStartersAndBench(extTeam, m.journee);

    const matchEventsList = [];

    const domSubsCount = Math.min(domBench.length, Math.floor(Math.random() * 4) + 1);
    const domSubstitutions = [];
    const availableDomBench = [...domBench];
    const currentDomActive = [...domStarters];

    for (let s = 0; s < domSubsCount; s++) {
      if (availableDomBench.length === 0) break;
      const subMinute = Math.floor(Math.random() * 40) + 46;
      const playerIn = availableDomBench.splice(Math.floor(Math.random() * availableDomBench.length), 1)[0];
      const outCandidates = currentDomActive.filter(p => p.poste !== 'G');
      if (outCandidates.length === 0) break;
      const playerOut = outCandidates[Math.floor(Math.random() * outCandidates.length)];

      const outIdx = currentDomActive.findIndex(p => p.id === playerOut.id);
      if (outIdx !== -1) currentDomActive[outIdx] = playerIn;

      domSubstitutions.push({ minute: subMinute, playerIn, playerOut });
      matchEventsList.push({
        match_id: m.id,
        player_id: playerIn.id,
        type: 'remplacement',
        detail: `entre pour ${playerOut.nom}`,
        minute: subMinute,
        journee: m.journee,
        saison: seasonNum,
        user_id: userId
      });
    }

    const extSubsCount = Math.min(extBench.length, Math.floor(Math.random() * 4) + 1);
    const extSubstitutions = [];
    const availableExtBench = [...extBench];
    const currentExtActive = [...extStarters];

    for (let s = 0; s < extSubsCount; s++) {
      if (availableExtBench.length === 0) break;
      const subMinute = Math.floor(Math.random() * 40) + 46;
      const playerIn = availableExtBench.splice(Math.floor(Math.random() * availableExtBench.length), 1)[0];
      const outCandidates = currentExtActive.filter(p => p.poste !== 'G');
      if (outCandidates.length === 0) break;
      const playerOut = outCandidates[Math.floor(Math.random() * outCandidates.length)];

      const outIdx = currentExtActive.findIndex(p => p.id === playerOut.id);
      if (outIdx !== -1) currentExtActive[outIdx] = playerIn;

      extSubstitutions.push({ minute: subMinute, playerIn, playerOut });
      matchEventsList.push({
        match_id: m.id,
        player_id: playerIn.id,
        type: 'remplacement',
        detail: `entre pour ${playerOut.nom}`,
        minute: subMinute,
        journee: m.journee,
        saison: seasonNum,
        user_id: userId
      });
    }

    const getActivePlayersAtMinute = (starters, substitutions, minute) => {
      let active = [...starters];
      substitutions.forEach(sub => {
        if (minute >= sub.minute) {
          const idx = active.findIndex(p => p.id === sub.playerOut.id);
          if (idx !== -1) active[idx] = sub.playerIn;
        }
      });
      return active;
    };

    for (let i = 0; i < scoreDom; i++) {
      const minute = Math.floor(Math.random() * 90) + 1;
      const activeAtMin = getActivePlayersAtMinute(domStarters, domSubstitutions, minute);
      const scorer = pickGoalScorer(activeAtMin);
      if (scorer) {
        matchEventsList.push({ match_id: m.id, player_id: scorer.id, type: 'but', minute, journee: m.journee, saison: seasonNum, user_id: userId });
        if (Math.random() < 0.75) {
          const assister = pickAssister(activeAtMin, scorer);
          if (assister) matchEventsList.push({ match_id: m.id, player_id: assister.id, type: 'passe', minute, journee: m.journee, saison: seasonNum, user_id: userId });
        }
      }
    }

    for (let i = 0; i < scoreExt; i++) {
      const minute = Math.floor(Math.random() * 90) + 1;
      const activeAtMin = getActivePlayersAtMinute(extStarters, extSubstitutions, minute);
      const scorer = pickGoalScorer(activeAtMin);
      if (scorer) {
        matchEventsList.push({ match_id: m.id, player_id: scorer.id, type: 'but', minute, journee: m.journee, saison: seasonNum, user_id: userId });
        if (Math.random() < 0.75) {
          const assister = pickAssister(extStarters, scorer);
          if (assister) matchEventsList.push({ match_id: m.id, player_id: assister.id, type: 'passe', minute, journee: m.journee, saison: seasonNum, user_id: userId });
        }
      }
    }

    const numYellowDom = Math.random() < 0.65 ? Math.floor(Math.random() * 3) + 1 : 0;
    for (let y = 0; y < numYellowDom; y++) {
      const minute = Math.floor(Math.random() * 88) + 2;
      const carded = pickCardPlayer(getActivePlayersAtMinute(domStarters, domSubstitutions, minute));
      if (carded) matchEventsList.push({ match_id: m.id, player_id: carded.id, type: 'carton_jaune', minute, journee: m.journee, saison: seasonNum, user_id: userId });
    }

    const numYellowExt = Math.random() < 0.65 ? Math.floor(Math.random() * 3) + 1 : 0;
    for (let y = 0; y < numYellowExt; y++) {
      const minute = Math.floor(Math.random() * 88) + 2;
      const carded = pickCardPlayer(getActivePlayersAtMinute(extStarters, extSubstitutions, minute));
      if (carded) matchEventsList.push({ match_id: m.id, player_id: carded.id, type: 'carton_jaune', minute, journee: m.journee, saison: seasonNum, user_id: userId });
    }

    // Carton rouge rare (~3.5% par camp)
    if (Math.random() < 0.035) {
      const minute = Math.floor(Math.random() * 80) + 10;
      const cardedRed = pickCardPlayer(getActivePlayersAtMinute(domStarters, domSubstitutions, minute));
      if (cardedRed) {
        matchEventsList.push({ match_id: m.id, player_id: cardedRed.id, type: 'carton_rouge', minute, journee: m.journee, saison: seasonNum, user_id: userId });
      }
    }

    if (Math.random() < 0.035) {
      const minute = Math.floor(Math.random() * 80) + 10;
      const cardedRed = pickCardPlayer(getActivePlayersAtMinute(extStarters, extSubstitutions, minute));
      if (cardedRed) {
        matchEventsList.push({ match_id: m.id, player_id: cardedRed.id, type: 'carton_rouge', minute, journee: m.journee, saison: seasonNum, user_id: userId });
      }
    }

    // Blessure rare (~8% par camp)
    if (Math.random() < 0.08) {
      const minute = Math.floor(Math.random() * 85) + 5;
      const injured = pickInjuredPlayer(getActivePlayersAtMinute(domStarters, domSubstitutions, minute));
      if (injured) {
        const duration = generateInjuryDuration();
        matchEventsList.push({
          match_id: m.id,
          player_id: injured.id,
          type: 'blessure',
          detail: duration.label,
          duration_matches: duration.matches,
          minute,
          journee: m.journee,
          saison: seasonNum,
          user_id: userId
        });
      }
    }

    if (Math.random() < 0.08) {
      const minute = Math.floor(Math.random() * 85) + 5;
      const injured = pickInjuredPlayer(getActivePlayersAtMinute(extStarters, extSubstitutions, minute));
      if (injured) {
        const duration = generateInjuryDuration();
        matchEventsList.push({
          match_id: m.id,
          player_id: injured.id,
          type: 'blessure',
          detail: duration.label,
          duration_matches: duration.matches,
          minute,
          journee: m.journee,
          saison: seasonNum,
          user_id: userId
        });
      }
    }

    return matchEventsList;
  }

  function simulateSingleMatchWithSubs(m, domTeam, extTeam, seasonNum, userId) {
    const { starters: domStarters } = getTeamStartersAndBench(domTeam, m.journee);
    const { starters: extStarters } = getTeamStartersAndBench(extTeam, m.journee);

    const domGen = domStarters.length > 0 ? domStarters.reduce((acc, p) => acc + (p.general || 75), 0) / domStarters.length : 75;
    const extGen = extStarters.length > 0 ? extStarters.reduce((acc, p) => acc + (p.general || 75), 0) / extStarters.length : 75;

    const diff = (domGen + 1.5) - extGen;
    const domLambda = Math.max(0.3, Math.min(4.5, 1.45 + (diff * 0.12)));
    const extLambda = Math.max(0.2, Math.min(4.0, 1.10 - (diff * 0.10)));

    const scoreDom = simulateGoals(domLambda);
    const scoreExt = simulateGoals(extLambda);

    const events = generateMatchEventsForCustomScore(m, domTeam, extTeam, scoreDom, scoreExt, seasonNum, userId);

    return { scoreDom, scoreExt, events };
  }

  async function handleSimulateJournee() {
    const currentJourneeMatches = seasonMatches.filter(m => m.journee === parseInt(journeeFilter, 10));
    if (currentJourneeMatches.length === 0) {
      alert("Aucun match à simuler pour cette journée.");
      return;
    }

    const unplayedCount = currentJourneeMatches.filter(m => m.statut !== 'terminé').length;
    const confirmText = unplayedCount === 0
      ? `Tous les matchs de la Journée ${journeeFilter} sont déjà joués. Voulez-vous re-simuler cette journée ?`
      : `Voulez-vous simuler automatiquement les ${currentJourneeMatches.length} matchs de la Journée ${journeeFilter} ?`;

    if (!window.confirm(confirmText)) return;

    setSimulating(true);

    try {
      const newEvents = [];
      const updatedMatches = [...matches];
      const uKey = currentUser?.email || 'local_user';

      for (const m of currentJourneeMatches) {
        const domTeam = teams.find(t => t.id === m.equipe_domicile_id) || { id: m.equipe_domicile_id, nom: 'Club Dom' };
        const extTeam = teams.find(t => t.id === m.equipe_exterieur_id) || { id: m.equipe_exterieur_id, nom: 'Club Ext' };
        const simResult = simulateSingleMatchWithSubs(m, domTeam, extTeam, m.saison || 1, uKey);

        const mIdx = updatedMatches.findIndex(matchItem => matchItem.id === m.id);
        if (mIdx !== -1) {
          updatedMatches[mIdx] = {
            ...updatedMatches[mIdx],
            score_domicile: simResult.scoreDom,
            score_exterieur: simResult.scoreExt,
            statut: 'terminé'
          };
        }

        newEvents.push(...simResult.events);
      }

      setMatches(updatedMatches);
      setMatchEvents(prev => [...prev.filter(e => !currentJourneeMatches.some(m => m.id === e.match_id)), ...newEvents]);

      const currentJ = parseInt(journeeFilter, 10);
      const currentS = parseInt(seasonFilter, 10);

      localStorage.setItem(`local_season_${uKey}`, currentS);
      localStorage.setItem(`local_journee_${uKey}`, currentJ);

      showNotif(`Journée ${journeeFilter} simulée avec succès !`);

      if (currentJ === 19) {
        await triggerAutomatedMercato(currentJ, currentS, 4, false);
      }

      if (currentJ === maxJourneesCount) {
        await triggerAutomatedMercato(currentJ, currentS, 15, true);
      }

      if (currentJ % 4 === 0) {
        await evaluateAndApplyPlayerEvolutions(currentJ, currentS);
      }
    } catch (err) {
      alert(`Erreur de simulation : ${err.message}`);
    }

    setSimulating(false);
  }

  async function handleStartNewSeason(isNextSeason = false) {
    if (!teams || teams.length < 2) {
      alert(`Erreur : Il vous faut au moins 2 équipes pour générer un calendrier.`);
      return;
    }

    const currentMaxSeason = matches.length > 0 ? Math.max(...matches.map(m => m.saison || 1), 1) : 1;
    const targetSeason = isNextSeason ? currentMaxSeason + 1 : 1;
    const seasonLabel = getSeasonLabel(targetSeason);
    const totalJournees = (teams.length % 2 === 0 ? teams.length - 1 : teams.length) * 2;
    const uKey = currentUser?.email || 'local_user';

    const confirmMsg = isNextSeason
      ? `Voulez-vous lancer la ${seasonLabel} ?\n\n- Vous conservez vos transferts et évolutions actuels.\n- Les joueurs prêtés retournent dans leur club d'origine.\n- ${totalJournees} Journées programmées.`
      : `Voulez-vous RÉINITIALISER complètement votre tournoi (Saison 1) ?\n\n- Tous les joueurs retrouveront leur GÉNÉRAL DE DÉPART et leur club initial.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      if (!isNextSeason) {
        localStorage.removeItem(`local_teams_${uKey}`);
        localStorage.removeItem(`local_players_${uKey}`);
        localStorage.removeItem(`local_matches_${uKey}`);
        localStorage.removeItem(`local_events_${uKey}`);
        localStorage.removeItem(`local_transfers_${uKey}`);
        localStorage.removeItem(`local_season_${uKey}`);
        localStorage.removeItem(`local_journee_${uKey}`);
        await fetchUserData(uKey);
        return;
      }

      const cleanedPlayers = players.map(p => {
        if (p.is_loan && p.loan_parent_id) {
          const originalTeam = teams.find(t => String(t.id) === String(p.loan_parent_id));
          return {
            ...p,
            equipe_id: p.loan_parent_id,
            teams: originalTeam,
            is_loan: false,
            loan_parent_id: null
          };
        }
        return p;
      });

      setPlayers(cleanedPlayers);

      const fixtures = buildRoundRobinFixtures(teams, uKey, targetSeason);
      const remainingMatches = matches.filter(m => (m.saison || 1) !== targetSeason);
      setMatches([...remainingMatches, ...fixtures]);

      showNotif(`${seasonLabel} lancée ! Retour des joueurs prêtés.`);

      setSeasonFilter(targetSeason);
      setJourneeFilter(1);
      setSeasonEvolutions({});

      localStorage.setItem(`local_season_${uKey}`, targetSeason);
      localStorage.setItem(`local_journee_${uKey}`, 1);
    } catch (err) {
      alert(`Erreur génération : ${err.message}`);
    }
  }

  const seasonMatches = matches.filter(m => (m.saison || 1) === parseInt(seasonFilter, 10));
  const seasonEvents = matchEvents.filter(e => (e.saison || 1) === parseInt(seasonFilter, 10));

  const availableSeasons = Array.from(
    new Set([...matches.map(m => m.saison || 1), 1, parseInt(seasonFilter, 10)])
  ).sort((a, b) => a - b);

  const classement = teams.map(team => {
    let points = 0;
    let joues = 0;
    let victoires = 0;
    let nuls = 0;
    let defaites = 0;
    let butsPour = 0;
    let butsContre = 0;

    seasonMatches.forEach(m => {
      if (m.statut === 'terminé') {
        if (m.equipe_domicile_id === team.id) {
          joues++;
          const scorePour = m.score_domicile ?? 0;
          const scoreContre = m.score_exterieur ?? 0;
          butsPour += scorePour;
          butsContre += scoreContre;

          if (scorePour > scoreContre) { points += 3; victoires++; }
          else if (scorePour === scoreContre) { points += 1; nuls++; }
          else { defaites++; }
        } else if (m.equipe_exterieur_id === team.id) {
          joues++;
          const scorePour = m.score_exterieur ?? 0;
          const scoreContre = m.score_domicile ?? 0;
          butsPour += scorePour;
          butsContre += scoreContre;

          if (scorePour > scoreContre) { points += 3; victoires++; }
          else if (scorePour === scoreContre) { points += 1; nuls++; }
          else { defaites++; }
        }
      }
    });

    const diff = butsPour - butsContre;
    return { ...team, points, joues, victoires, nuls, defaites, butsPour, butsContre, diff };
  }).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return b.butsPour - a.butsPour;
  });

  const playersWithStats = players.map(p => {
    const buts = seasonEvents.filter(e => String(e.player_id) === String(p.id) && e.type === 'but').length;
    const passes = seasonEvents.filter(e => String(e.player_id) === String(p.id) && e.type === 'passe').length;
    const assignedTeam = teams.find(t => String(t.id) === String(p.equipe_id));
    return { ...p, buts, passes_decisives: passes, teams: assignedTeam };
  });

  const topButeurs = [...playersWithStats]
    .filter(j => j.buts > 0)
    .sort((a, b) => b.buts - a.buts);

  const topPasseurs = [...playersWithStats]
    .filter(j => j.passes_decisives > 0)
    .sort((a, b) => b.passes_decisives - a.passes_decisives);

  const availableSellerTeams = teams.filter(t => {
    const count = players.filter(p => String(p.equipe_id) === String(t.id)).length;
    return count > 16;
  });

  const availablePlayersForTransfer = players.filter(p => String(p.equipe_id) === String(transferFromTeamId));

  const availableDestinationTeams = teams.filter(t => {
    if (String(t.id) === String(transferFromTeamId)) return false;
    const count = players.filter(p => String(p.equipe_id) === String(t.id)).length;
    return count < 28;
  });

  function handleFromTeamChange(e) {
    const newFromTeamId = e.target.value;
    setTransferFromTeamId(newFromTeamId);
    setTransferPlayerId('');
  }

  function handlePlayerSelectChange(e) {
    const selectedId = e.target.value;
    setTransferPlayerId(selectedId);
    const playerObj = players.find(p => p.id === selectedId);
    if (playerObj && playerObj.valeur_marchande) {
      setTransferFee(playerObj.valeur_marchande);
    }
  }

  async function handleTransferPlayer(e) {
    e.preventDefault();
    if (!transferFromTeamId || !transferPlayerId || !transferToTeamId) {
      showNotif("Veuillez sélectionner le club d'origine, le joueur et le club de destination.");
      return;
    }

    if (transferFromTeamId === transferToTeamId) {
      showNotif("Le club de destination doit être différent du club d'origine !");
      return;
    }

    const sellerCount = players.filter(p => String(p.equipe_id) === String(transferFromTeamId)).length;
    if (sellerCount <= 16) {
      showNotif("Ce club a 16 joueurs ou moins : il ne peut plus céder de joueur !");
      return;
    }

    const buyerCount = players.filter(p => String(p.equipe_id) === String(transferToTeamId)).length;
    if (buyerCount >= 28) {
      showNotif("Ce club a atteint le quota max de 28 joueurs : recrutement impossible !");
      return;
    }

    const selectedPlayer = players.find(p => p.id === transferPlayerId);
    const destTeam = teams.find(t => String(t.id) === String(transferToTeamId));
    const origTeam = teams.find(t => String(t.id) === String(transferFromTeamId));
    if (!selectedPlayer) return;

    setTransferLoading(true);

    const isLoan = transferType === 'pret';
    const fee = isLoan ? 0 : parseInt(transferFee, 10);

    const updatedPlayers = players.map(p => {
      if (p.id === transferPlayerId) {
        return {
          ...p,
          equipe_id: transferToTeamId,
          valeur_marchande: fee,
          teams: destTeam,
          is_loan: isLoan,
          loan_parent_id: isLoan ? (p.loan_parent_id || transferFromTeamId) : null
        };
      }
      return p;
    });

    const updatedTeamsList = teams.map(t => {
      if (String(t.id) === String(transferFromTeamId) && t.lineup_ids) {
        let lineIds = t.lineup_ids;
        if (typeof lineIds === 'string') {
          try { lineIds = JSON.parse(lineIds); } catch (e) { lineIds = []; }
        }
        if (Array.isArray(lineIds)) {
          return { ...t, lineup_ids: lineIds.filter(id => id !== transferPlayerId) };
        }
      }
      return t;
    });

    const newTransfer = {
      id: Date.now(),
      player_id: transferPlayerId,
      old_team_id: transferFromTeamId,
      new_team_id: transferToTeamId,
      fee: fee,
      type: transferType,
      user_id: currentUser?.email || 'local_user',
      players: selectedPlayer,
      old_team: origTeam,
      new_team: destTeam
    };

    setPlayers(updatedPlayers);
    setTeams(updatedTeamsList);
    setTransfers(prev => [newTransfer, ...prev]);

    showNotif(`${isLoan ? 'Prêt' : 'Transfert'} de ${selectedPlayer.nom} validé !`);
    setTransferFromTeamId('');
    setTransferPlayerId('');
    setTransferToTeamId('');
    setTransferFee(10000000);
    setTransferLoading(false);
  }

  async function handleCancelTransfer(transfer) {
    if (!window.confirm(`Voulez-vous annuler le mouvement de "${transfer.players?.nom || 'ce joueur'}" ?`)) {
      return;
    }

    const updatedPlayers = players.map(p => {
      if (p.id === transfer.player_id) {
        return { ...p, equipe_id: transfer.old_team_id, teams: transfer.old_team, is_loan: false, loan_parent_id: null };
      }
      return p;
    });

    setPlayers(updatedPlayers);
    setTransfers(prev => prev.filter(t => t.id !== transfer.id));
    showNotif(`Mouvement annulé : ${transfer.players?.nom || 'Joueur'} est retourné à son club.`);
  }

  async function handleDeletePlayer(playerId, playerNom) {
    if (!window.confirm(`Supprimer définitivement le joueur "${playerNom}" ?`)) return;
    setPlayers(prev => prev.filter(p => p.id !== playerId));
    showNotif(`Le joueur "${playerNom}" a été supprimé.`);
  }

  async function handleUpdatePlayer(e) {
    e.preventDefault();
    if (!editingPlayer) return;

    const newGen = editingPlayer.general ? parseInt(editingPlayer.general, 10) : 75;
    const newAge = editingPlayer.age ? parseInt(editingPlayer.age, 10) : 22;
    const calculatedVal = editingPlayer.valeur_marchande !== undefined 
      ? parseInt(editingPlayer.valeur_marchande, 10) 
      : calculateMarketValue(newGen, newAge);

    const updatedPlayers = players.map(p => {
      if (p.id === editingPlayer.id) {
        return {
          ...p,
          nom: editingPlayer.nom,
          poste: editingPlayer.poste,
          numero: editingPlayer.numero ? parseInt(editingPlayer.numero, 10) : 10,
          general: newGen,
          general_base: newGen,
          age: newAge,
          valeur_marchande: calculatedVal
        };
      }
      return p;
    });

    setPlayers(updatedPlayers);
    showNotif(`Joueur "${editingPlayer.nom}" mis à jour (Base: ${newGen} GEN) !`);
    setEditingPlayer(null);
  }

  // Mise à jour de logo synchronisée Render + compression
  async function handleUpdateTeamLogo(e) {
    e.preventDefault();
    if (!editingTeamLogo || !newLogoFile) return;

    setLogoUpdating(true);
    try {
      const logoUrl = await compressImage(newLogoFile, 128);

      await fetch(`${API_URL}/teams/${editingTeamLogo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo_url: logoUrl })
      }).catch(() => console.log('Mode local'));

      setTeams(prev => prev.map(t => String(t.id) === String(editingTeamLogo.id) ? { ...t, logo_url: logoUrl } : t));
      showNotif(`✓ Logo de "${editingTeamLogo.nom}" sauvegardé pour tous les joueurs !`);
      setEditingTeamLogo(null);
      setNewLogoFile(null);
    } catch (err) {
      showNotif(`Erreur : ${err.message}`);
    }
    setLogoUpdating(false);
  }

 async function openMatchDetails(match) {
    const dom = teams.find(t => String(t.id) === String(match.equipe_domicile_id)) || { id: match.equipe_domicile_id, nom: 'Club Domicile', logo_url: '' };
    const ext = teams.find(t => String(t.id) === String(match.equipe_exterieur_id)) || { id: match.equipe_exterieur_id, nom: 'Club Extérieur', logo_url: '' };

    setSelectedMatch({ ...match, dom, ext });

    const filtered = matchEvents
      .filter(ev => ev.match_id === match.id)
      .sort((a, b) => (parseInt(a.minute, 10) || 0) - (parseInt(b.minute, 10) || 0));

    const enriched = filtered.map(ev => {
      const pObj = players.find(p => String(p.id) === String(ev.player_id));
      return {
        ...ev,
        player_nom: pObj?.nom || 'Joueur inconnu',
        player_equipe_id: pObj?.equipe_id || null
      };
    });
    setSelectedMatchEvents(enriched);
  }

  function handleScoreInputChange(matchId, teamType, val) {
    setScoresInput(prev => ({ ...prev, [matchId]: { ...prev[matchId], [teamType]: val } }));
  }

  async function handleSaveMatchScore(match) {
    const matchScores = scoresInput[match.id] || {};
    const scoreDom = parseInt(matchScores.dom !== undefined ? matchScores.dom : match.score_domicile, 10);
    const scoreExt = parseInt(matchScores.ext !== undefined ? matchScores.ext : match.score_exterieur, 10);

    if (isNaN(scoreDom) || isNaN(scoreExt) || scoreDom < 0 || scoreExt < 0) { 
      showNotif("Saisissez un score valide (0 ou supérieur)."); 
      return; 
    }

    const domTeam = teams.find(t => String(t.id) === String(match.equipe_domicile_id)) || { id: match.equipe_domicile_id, nom: 'Club Dom' };
    const extTeam = teams.find(t => String(t.id) === String(match.equipe_exterieur_id)) || { id: match.equipe_exterieur_id, nom: 'Club Ext' };
    const uKey = currentUser?.email || 'local_user';

    try {
      const events = generateMatchEventsForCustomScore(
        match, domTeam, extTeam, scoreDom, scoreExt, match.saison || 1, uKey
      );

      setMatches(prev => prev.map(m => m.id === match.id ? { ...m, score_domicile: scoreDom, score_exterieur: scoreExt, statut: 'terminé' } : m));
      setMatchEvents(prev => [...prev.filter(e => e.match_id !== match.id), ...events]);

      const currentJ = match.journee;
      const currentS = match.saison || 1;

      localStorage.setItem(`local_season_${uKey}`, currentS);
      localStorage.setItem(`local_journee_${uKey}`, currentJ);

      showNotif(`Score ${scoreDom} - ${scoreExt} et événements enregistrés !`);

      const otherMatchesInJ = seasonMatches.filter(m => m.journee === currentJ && m.id !== match.id);
      const allCompleted = otherMatchesInJ.every(m => m.statut === 'terminé');

      if (allCompleted) {
        if (currentJ === 19) {
          await triggerAutomatedMercato(currentJ, currentS, 4, false);
        }
        if (currentJ === maxJourneesCount) {
          await triggerAutomatedMercato(currentJ, currentS, 15, true);
        }
        if (currentJ % 4 === 0) {
          await evaluateAndApplyPlayerEvolutions(currentJ, currentS);
        }
      }
    } catch (err) {
      showNotif(`Erreur : ${err.message}`);
    }
  }

  async function handleAddTeam(e) {
    e.preventDefault();
    if (!newTeamName) return;
    setUploading(true);
    let logoUrl = '';

    if (logoFile) {
      try {
        logoUrl = await compressImage(logoFile, 128);
      } catch (err) {
        showNotif(`Erreur image : ${err.message}`);
        setUploading(false);
        return;
      }
    }

    const newTeam = {
      id: 'team_' + Date.now(),
      nom: newTeamName,
      logo_url: logoUrl,
      formation: '4-3-3',
      points: 0
    };

    setTeams(prev => [...prev, newTeam]);
    setUploading(false);
    showNotif(`Équipe "${newTeamName}" créée !`);
    setNewTeamName(''); 
    setLogoFile(null);
  }

  async function handleAddPlayer(e) {
    e.preventDefault();
    if (!newPlayer.nom || !newPlayer.equipe_id) return;

    const teamCount = players.filter(p => String(p.equipe_id) === String(newPlayer.equipe_id)).length;
    if (teamCount >= 28) {
      showNotif("Cette équipe a déjà atteint la limite maximale de 28 joueurs !");
      return;
    }

    const gen = parseInt(newPlayer.general, 10) || 75;
    const age = parseInt(newPlayer.age, 10) || 22;
    const val = parseInt(newPlayer.valeur, 10) || calculateMarketValue(gen, age);
    const assignedTeam = teams.find(t => String(t.id) === String(c.player.equipe_id));

        changedPlayers.push({
          id: c.player.id,
          nom: c.player.nom,
          teamName: assignedTeam?.nom || c.player.teams?.nom || 'Club',
          poste: c.player.poste,
          oldGen: c.currentGen,
          newGen: newGen,
          delta: c.delta,
          seasonTotal: currentSeasonMap[c.player.id],
          oldVal: c.currentVal,
          newVal: newVal,
          buts: c.buts,
          passes: c.passes
        });

    setPlayers(prev => [...prev, createdPlayer]);
    showNotif(`Joueur "${newPlayer.nom}" ajouté (${formatMoney(val)}) !`);
    setNewPlayer({ nom: '', equipe_id: newPlayer.equipe_id, numero: 10, general: 75, valeur: 10000000, age: 22, poste: 'MC' });
  }

  function formatMoney(amount) {
    if (!amount) return '0 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
  }

  function renderEventBadge(ev) {
    switch (ev.type) {
      case 'but':
        return (
          <span className="flex items-center gap-1 font-extrabold text-white text-xs bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
            ⚽ But
          </span>
        );
      case 'passe':
        return (
          <span className="flex items-center gap-1 font-bold text-indigo-300 text-xs bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 rounded-lg">
            🎯 Passe D.
          </span>
        );
      case 'carton_jaune':
        return (
          <span className="flex items-center gap-1 font-bold text-amber-300 text-xs bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-lg">
            🟨 Jaune
          </span>
        );
      case 'carton_rouge':
        return (
          <span className="flex items-center gap-1 font-bold text-rose-300 text-xs bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded-lg">
            🟥 Rouge
          </span>
        );
      case 'blessure':
        return (
          <span className="flex items-center gap-1 font-black text-rose-400 text-xs bg-rose-600/20 border border-rose-500/40 px-2 py-0.5 rounded-lg shadow-sm">
            🚑 {ev.detail ? `Blessé (${ev.detail})` : 'Blessure'}
          </span>
        );
      case 'remplacement':
        return (
          <span className="flex items-center gap-1 font-semibold text-slate-300 text-xs bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-lg">
            🔄 Entrée
          </span>
        );
      default:
        return <span className="text-xs text-slate-400 font-bold">{ev.type}</span>;
    }
  }

  const teamRoster = selectedTeam ? getSortedTeamPlayers(selectedTeam.id) : [];

  function openTeamLineup(team) {
    const fullTeam = teams.find(t => String(t.id) === String(team.id)) || team;
    setSelectedLineupTeam(fullTeam);
    setSelectedSlot(null);

    const { starters, bench } = getTeamStartersAndBench(fullTeam, journeeFilter);
    const savedFormation = fullTeam.formation || '4-3-3';
    setCurrentFormation(savedFormation);

    if (starters.length >= 11) {
      setTeamLineupPlayers(starters.slice(0, 11));
      setTeamBenchPlayers(bench);
    } else {
      const allAvailable = [...starters, ...bench];
      buildLineupForFormation(allAvailable, savedFormation);
    }
  }

  function buildLineupForFormation(allPlayers, formationKey) {
    const config = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
    setCurrentFormation(formationKey);

    const gks = allPlayers.filter(p => p.poste === 'G');
    const defs = allPlayers.filter(p => ['DC', 'DD', 'DG', 'DLD', 'DLG'].includes(p.poste));
    const mids = allPlayers.filter(p => ['MDC', 'MC', 'MOC', 'MD', 'MG'].includes(p.poste));
    const atts = allPlayers.filter(p => ['BU', 'AT', 'AD', 'AG', 'SA'].includes(p.poste));

    const selectedGK = gks.slice(0, 1);
    const selectedDEF = defs.slice(0, config.def);
    const selectedMID = mids.slice(0, config.mid);
    const selectedATT = atts.slice(0, config.att);

    const startersSet = new Set([...selectedGK, ...selectedDEF, ...selectedMID, ...selectedATT].map(p => p.id));
    const remaining = allPlayers.filter(p => !startersSet.has(p.id));

    while (selectedGK.length + selectedDEF.length + selectedMID.length + selectedATT.length < 11 && remaining.length > 0) {
      const nextP = remaining.shift();
      if (selectedGK.length === 0) selectedGK.push(nextP);
      else if (selectedDEF.length < config.def) selectedDEF.push(nextP);
      else if (selectedMID.length < config.mid) selectedMID.push(nextP);
      else selectedATT.push(nextP);
      startersSet.add(nextP.id);
    }

    const finalStarters = [...selectedGK, ...selectedDEF, ...selectedMID, ...selectedATT];
    const finalBench = allPlayers.filter(p => !startersSet.has(p.id));

    setTeamLineupPlayers(finalStarters);
    setTeamBenchPlayers(finalBench);
  }

  function handleFormationChange(newFmt) {
    const allCombined = [...teamLineupPlayers, ...teamBenchPlayers];
    buildLineupForFormation(allCombined, newFmt);
  }

  async function handleSaveLineup() {
    if (!selectedLineupTeam) return;

    setSavingLineup(true);
    const starterIds = teamLineupPlayers.map(p => p.id);
    const uKey = currentUser?.email || 'local_user';

    try {
      await fetch(`${API_URL}/teams/${selectedLineupTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formation: currentFormation,
          lineup_ids: starterIds
        })
      }).catch(() => console.log('Mode local actif'));

      const updatedTeams = teams.map(t =>
        String(t.id) === String(selectedLineupTeam.id)
          ? { ...t, formation: currentFormation, lineup_ids: starterIds }
          : t
      );

      setTeams(updatedTeams);
      setSelectedLineupTeam(prev => ({ ...prev, formation: currentFormation, lineup_ids: starterIds }));
      
      try {
        localStorage.setItem(`local_teams_${uKey}`, JSON.stringify(updatedTeams));
      } catch (e) {}

      showNotif(`✓ Composition de "${selectedLineupTeam.nom}" (${currentFormation}) enregistrée !`);
    } catch (err) {
      console.error('Erreur compo:', err);
      showNotif(`Erreur : ${err.message}`);
    } finally {
      setSavingLineup(false);
    }
  }

  function handleSelectSlot(type, index) {
    if (!selectedSlot) {
      setSelectedSlot({ type, index });
      return;
    }

    if (selectedSlot.type === type && selectedSlot.index === index) {
      setSelectedSlot(null);
      return;
    }

    const updatedPitch = [...teamLineupPlayers];
    const updatedBench = [...teamBenchPlayers];

    if (selectedSlot.type === 'pitch' && type === 'pitch') {
      const temp = updatedPitch[selectedSlot.index];
      updatedPitch[selectedSlot.index] = updatedPitch[index];
      updatedPitch[index] = temp;
      setTeamLineupPlayers(updatedPitch);
      showNotif("Postes permutés ! N'oubliez pas d'enregistrer.");
    } else if (selectedSlot.type === 'bench' && type === 'pitch') {
      const benchP = updatedBench[selectedSlot.index];
      const pitchP = updatedPitch[index];
      updatedPitch[index] = benchP;
      updatedBench[selectedSlot.index] = pitchP;
      setTeamLineupPlayers(updatedPitch);
      setTeamBenchPlayers(updatedBench);
      showNotif(`Changement : ${benchP.nom} entre pour ${pitchP.nom}`);
    } else if (selectedSlot.type === 'pitch' && type === 'bench') {
      const pitchP = updatedPitch[selectedSlot.index];
      const benchP = updatedBench[index];
      updatedPitch[selectedSlot.index] = benchP;
      updatedBench[index] = pitchP;
      setTeamLineupPlayers(updatedPitch);
      setTeamBenchPlayers(updatedBench);
      showNotif(`Changement : ${benchP.nom} entre pour ${pitchP.nom}`);
    }

    setSelectedSlot(null);
  }

  const formationConfig = FORMATIONS[currentFormation] || FORMATIONS['4-3-3'];
  const pitchGK = teamLineupPlayers.slice(0, 1);
  const pitchDEF = teamLineupPlayers.slice(1, 1 + formationConfig.def);
  const pitchMID = teamLineupPlayers.slice(1 + formationConfig.def, 1 + formationConfig.def + formationConfig.mid);
  const pitchATT = teamLineupPlayers.slice(1 + formationConfig.def + formationConfig.mid, 11);

  const pitchAvgGen = teamLineupPlayers.length > 0
    ? Math.round(teamLineupPlayers.reduce((acc, p) => acc + (p?.general || 75), 0) / teamLineupPlayers.length)
    : 0;

  const maxJourneesCount = seasonMatches.length > 0
    ? Math.max(...seasonMatches.map(m => m.journee || 1))
    : (teams.length >= 2 ? (teams.length % 2 === 0 ? teams.length - 1 : teams.length) * 2 : 38);

  const currentMatchesList = seasonMatches.filter(m => m.journee === parseInt(journeeFilter, 10));
  const isCurrentJourneeCompleted = currentMatchesList.length > 0 && currentMatchesList.every(m => m.statut === 'terminé');

  function handleNextJournee() {
    if (!isCurrentJourneeCompleted) {
      showNotif("Jouez ou simulez d'abord tous les matchs de la journée avant d'avancer !");
      return;
    }
    if (journeeFilter < maxJourneesCount) {
      const nextJ = journeeFilter + 1;
      setJourneeFilter(nextJ);
      localStorage.setItem(`local_journee_${currentUser.email}`, nextJ);
    } else {
      showNotif("Vous êtes sur la dernière journée de cette saison !");
    }
  }

  function handlePrevJournee() {
    if (journeeFilter > 1) {
      const prevJ = journeeFilter - 1;
      setJourneeFilter(prevJ);
      localStorage.setItem(`local_journee_${currentUser.email}`, prevJ);
    }
  }

  const PitchPlayerSlot = ({ player, globalIndex }) => {
    const isSelected = selectedSlot?.type === 'pitch' && selectedSlot?.index === globalIndex;

    if (!player) {
      return (
        <div 
          onClick={() => handleSelectSlot('pitch', globalIndex)}
          className="w-12 h-12 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center text-white/60 text-xs font-bold bg-black/20 cursor-pointer"
        >
          +
        </div>
      );
    }

    return (
      <div
        onClick={() => handleSelectSlot('pitch', globalIndex)}
        className={`flex flex-col items-center group cursor-pointer transition-all duration-200 ${
          isSelected ? 'scale-125 z-20' : 'hover:scale-110'
        }`}
      >
        <div className="relative">
          <div className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-slate-900 border-2 shadow-xl flex items-center justify-center text-white text-base font-black ring-2 overflow-hidden transition-all ${
            isSelected 
              ? 'border-amber-400 ring-amber-400 ring-4 animate-pulse bg-slate-800' 
              : 'border-white ring-emerald-500/50'
          }`}>
            <span className="font-mono tracking-tight drop-shadow-md">
              {player.numero !== undefined && player.numero !== null ? player.numero : 10}
            </span>
          </div>

          <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-md">
            {player.general || 75}
          </span>

          <span className="absolute -bottom-1 -left-1 bg-indigo-600 text-white font-bold text-[8px] px-1 rounded shadow">
            {player.poste || 'MC'}
          </span>
        </div>

        <span className={`text-[10px] sm:text-xs font-bold mt-1 px-2 py-0.5 rounded-full shadow text-center max-w-[85px] truncate transition-colors ${
          isSelected ? 'bg-amber-400 text-slate-950 font-black' : 'bg-black/80 text-white'
        }`}>
          {player.nom.split(' ').pop()}
        </span>
      </div>
    );
  };

 const homeEvents = selectedMatch 
    ? selectedMatchEvents
        .filter(ev => String(ev.player_equipe_id) === String(selectedMatch.equipe_domicile_id))
        .sort((a, b) => (parseInt(a.minute, 10) || 0) - (parseInt(b.minute, 10) || 0))
    : [];

  const awayEvents = selectedMatch 
    ? selectedMatchEvents
        .filter(ev => String(ev.player_equipe_id) === String(selectedMatch.equipe_exterieur_id))
        .sort((a, b) => (parseInt(a.minute, 10) || 0) - (parseInt(b.minute, 10) || 0))
    : [];

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-6">
            <div className="bg-indigo-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-lg shadow-indigo-600/30 mb-3">⚽</div>
            <h1 className="text-2xl font-black text-white">LIGUE DE FOOTBALL</h1>
            <p className="text-xs text-slate-400 mt-1">Connectez-vous pour accéder à vos saisons individuelles</p>
          </div>

          {authError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold px-4 py-3 rounded-xl mb-4 text-center">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Courriel</label>
              <input
                type="email"
                placeholder="nom@exemple.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Mot de passe</label>
              <input
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              {authMode === 'login' ? 'Se connecter' : "Créer mon compte"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            {authMode === 'login' ? (
              <p className="text-xs text-slate-400">
                Pas encore de compte ?{' '}
                <button
                  onClick={() => { setAuthMode('register'); setAuthError(''); }}
                  className="text-indigo-400 font-bold hover:underline cursor-pointer"
                >
                  S'inscrire
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Déjà inscrit ?{' '}
                <button
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className="text-indigo-400 font-bold hover:underline cursor-pointer"
                >
                  Se connecter
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center">
        <div className="text-3xl mb-4 animate-spin">⚽</div>
        <p className="text-slate-400 font-bold">Chargement de votre saison...</p>
      </div>
    );
  }

  const navTabs = [
    { id: 'classement', label: '🏆 Classement' },
    { id: 'matchs', label: '📅 Matchs' },
    { id: 'buteurs', label: '👟 Stats Joueurs' },
    { id: 'transferts', label: '🔄 Transferts & Prêts' }
  ];

  if (isAdmin) {
    navTabs.push({ id: 'admin', label: '⚙️ Admin' });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">⚽</div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white">LIGUE DE FOOTBALL</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-emerald-400 font-medium">✓ Connecté : <strong className="text-white">{currentUser.email}</strong> {isAdmin && <span className="ml-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded text-[10px]">ADMIN</span>}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-2">
              <div className="flex items-center bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80">
                {navTabs.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
                      tab === item.id
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </nav>

            <button
              onClick={handleLogout}
              className="bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-bold px-3 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              title="Se déconnecter"
            >
              <span>🚪</span> Déconnexion
            </button>
          </div>
        </div>
      </header>

      {notification && (
        <div className="max-w-md mx-auto mt-4 px-4">
          <div className="bg-indigo-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl text-center border border-indigo-400">
            {notification}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 mt-8">
        {tab === 'classement' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">🏆 Classement Général</h2>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Top 4 : Qualification</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> 3 Derniers : Relégation</span>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-slate-400 pl-2">Saison :</span>
                <select
                  value={seasonFilter}
                  onChange={(e) => {
                    const s = parseInt(e.target.value, 10);
                    setSeasonFilter(s);
                    setJourneeFilter(1);
                    localStorage.setItem(`local_season_${currentUser.email}`, s);
                    localStorage.setItem(`local_journee_${currentUser.email}`, 1);
                  }}
                  className="bg-slate-900 border border-slate-700 text-indigo-400 font-bold text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {availableSeasons.map((s) => (
                    <option key={s} value={s}>{getSeasonLabel(s)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[620px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3 text-center">#</th>
                    <th className="py-3 px-4">Équipe</th>
                    <th className="py-3 px-2 text-center">MJ</th>
                    <th className="py-3 px-2 text-center text-emerald-400">V</th>
                    <th className="py-3 px-2 text-center text-slate-300">N</th>
                    <th className="py-3 px-2 text-center text-rose-400">D</th>
                    <th className="py-3 px-2 text-center text-indigo-300">BP</th>
                    <th className="py-3 px-2 text-center text-amber-300">BC</th>
                    <th className="py-3 px-2 text-center">Diff</th>
                    <th className="py-3 px-4 text-center">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {classement.map((eq, i) => {
                    const isTopFour = i < 4;
                    const isBottomThree = classement.length >= 4 && i >= classement.length - 3;
                    const isDiffPositive = eq.diff > 0;
                    const isDiffZero = eq.diff === 0;

                    return (
                      <tr
                        key={eq.id}
                        onClick={() => setSelectedTeam(eq)}
                        className={`transition-colors cursor-pointer group ${
                          isTopFour 
                            ? 'border-l-4 border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10' 
                            : isBottomThree 
                            ? 'border-l-4 border-rose-500 bg-rose-500/5 hover:bg-rose-500/10' 
                            : 'hover:bg-slate-800/60 border-l-4 border-transparent'
                        }`}
                      >
                        <td className="py-4 px-3 font-mono font-bold text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs ${
                            isTopFour 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                              : isBottomThree 
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                              : 'text-slate-400 group-hover:text-indigo-400'
                          }`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {eq.logo_url ? (
                              <img src={eq.logo_url} alt="" className="w-8 h-8 object-contain rounded-full bg-slate-800 p-0.5" />
                            ) : (
                              <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-xs">🛡️</div>
                            )}
                            <span className="font-bold text-white group-hover:text-indigo-400 transition-colors">
                              {eq.nom}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-2 text-center text-slate-400 font-semibold">{eq.joues}</td>
                        <td className="py-4 px-2 text-center text-emerald-400 font-bold">{eq.victoires}</td>
                        <td className="py-4 px-2 text-center text-slate-400 font-medium">{eq.nuls}</td>
                        <td className="py-4 px-2 text-center text-rose-400 font-bold">{eq.defaites}</td>
                        <td className="py-4 px-2 text-center text-indigo-300 font-mono font-medium">{eq.butsPour}</td>
                        <td className="py-4 px-2 text-center text-amber-300 font-mono font-medium">{eq.butsContre}</td>
                        <td className="py-4 px-2 text-center font-mono font-bold">
                          <span className={isDiffPositive ? 'text-emerald-400' : isDiffZero ? 'text-slate-400' : 'text-rose-400'}>
                            {isDiffPositive ? `+${eq.diff}` : eq.diff}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="inline-block font-extrabold px-3 py-1 rounded-full border font-mono bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                            {eq.points} pts
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'matchs' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">📅 Calendrier des Rencontres</h2>
                <p className="text-xs text-slate-400 mt-1">
                  {!isCurrentJourneeCompleted ? (
                    <span className="text-amber-400 font-semibold">⚠️ Jouez ou simulez la Journée {journeeFilter} avant d'avancer</span>
                  ) : (
                    <span className="text-emerald-400 font-semibold">✓ Journée {journeeFilter} terminée ! Cliquez sur ▶ pour avancer</span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 pl-1.5">Saison :</span>
                  <select
                    value={seasonFilter}
                    onChange={(e) => {
                      const s = parseInt(e.target.value, 10);
                      setSeasonFilter(s);
                      setJourneeFilter(1);
                      localStorage.setItem(`local_season_${currentUser.email}`, s);
                      localStorage.setItem(`local_journee_${currentUser.email}`, 1);
                    }}
                    className="bg-slate-900 border border-slate-700 text-indigo-400 font-bold text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {availableSeasons.map((s) => (
                      <option key={s} value={s}>{getSeasonLabel(s)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
                  <button
                    type="button"
                    onClick={handlePrevJournee}
                    disabled={journeeFilter <= 1}
                    className="bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white text-xs font-bold w-8 h-8 rounded-lg transition-all flex items-center justify-center"
                  >
                    ◀
                  </button>

                  <span className="text-xs font-extrabold text-white px-3 font-mono">
                    J<strong className="text-indigo-400 text-sm ml-0.5">{journeeFilter}</strong> <span className="text-slate-500 text-[11px]">/ {maxJourneesCount}</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleNextJournee}
                    disabled={journeeFilter >= maxJourneesCount || !isCurrentJourneeCompleted}
                    className={`w-8 h-8 rounded-lg text-xs font-black transition-all flex items-center justify-center shadow-md ${
                      !isCurrentJourneeCompleted
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-40'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95'
                    }`}
                  >
                    ▶
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveTournamentProgress}
                  disabled={savingProgress}
                  className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <span>💾</span> {savingProgress ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>

                <button
                  type="button"
                  onClick={handleSimulateJournee}
                  disabled={simulating || seasonMatches.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>⚡</span> {simulating ? 'Simulation...' : 'Simuler la Journée'}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStartNewSeason(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-2.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                    title="Réinitialiser Saison 1"
                  >
                    🔄
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartNewSeason(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <span>🚀</span> Saison +1
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-1">
              {seasonMatches.filter((m) => m.journee === parseInt(journeeFilter, 10)).length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                  <p className="text-slate-400 font-medium text-sm mb-4">Aucun match programmé pour la Saison {seasonFilter}.</p>
                  <button
                    type="button"
                    onClick={handleGenerateCurrentSchedule}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-lg cursor-pointer flex items-center gap-2 mx-auto"
                  >
                    <span>🔄</span> Générer le Calendrier
                  </button>
                </div>
              ) : (
                seasonMatches
                  .filter((m) => m.journee === parseInt(journeeFilter, 10))
                  .sort((a, b) => (a.id > b.id ? 1 : -1))
                  .map((m) => {
                    const domTeam = teams.find(t => String(t.id) === String(m.equipe_domicile_id)) || { id: m.equipe_domicile_id, nom: 'Équipe Domicile', logo_url: '' };
                    const extTeam = teams.find(t => String(t.id) === String(m.equipe_exterieur_id)) || { id: m.equipe_exterieur_id, nom: 'Équipe Extérieur', logo_url: '' };
                    const currentDomInput = scoresInput[m.id]?.dom !== undefined ? scoresInput[m.id].dom : (m.score_domicile ?? '');
                    const currentExtInput = scoresInput[m.id]?.ext !== undefined ? scoresInput[m.id].ext : (m.score_exterieur ?? '');

                    return (
                      <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div 
                          onClick={() => domTeam && openTeamLineup(domTeam)}
                          className="flex items-center gap-3 sm:w-5/12 justify-start w-full cursor-pointer group min-w-0"
                        >
                          {domTeam?.logo_url ? (
                            <img src={domTeam.logo_url} className="w-10 h-10 object-contain group-hover:scale-110 transition-transform shrink-0" alt="" />
                          ) : (
                            <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-xs">🛡️</div>
                          )}
                          <span className="font-bold text-base text-white group-hover:text-indigo-400 transition-colors truncate">
                            {domTeam?.nom || 'Équipe Domicile'}
                          </span>
                        </div>

                        <div className="flex items-center justify-center gap-2 sm:gap-3 shrink-0 my-2 sm:my-0">
                          <button
                            type="button"
                            onClick={() => handleRollDice(m.id)}
                            className="bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 text-sm font-black p-2.5 rounded-xl transition-all cursor-pointer shadow-md active:scale-95 mr-0.5"
                            title="Lancer le dé (0 à 6 buts)"
                          >
                            🎲
                          </button>

                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={currentDomInput}
                            onChange={(e) => handleScoreInputChange(m.id, 'dom', e.target.value)}
                            className="w-12 h-11 sm:w-13 sm:h-12 bg-slate-950 text-white font-mono font-black text-xl text-center rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />

                          <button
                            type="button"
                            onClick={() => openMatchDetails(m)}
                            className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-black tracking-widest px-3.5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md active:scale-95 uppercase"
                          >
                            VS
                          </button>

                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={currentExtInput}
                            onChange={(e) => handleScoreInputChange(m.id, 'ext', e.target.value)}
                            className="w-12 h-11 sm:w-13 sm:h-12 bg-slate-950 text-white font-mono font-black text-xl text-center rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />

                          <button
                            onClick={() => handleSaveMatchScore(m)}
                            className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold w-9 h-11 sm:w-10 sm:h-12 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center ml-0.5"
                          >
                            ✓
                          </button>
                        </div>

                        <div className="flex items-center gap-3 sm:w-5/12 justify-end w-full min-w-0">
                          <div 
                            onClick={() => extTeam && openTeamLineup(extTeam)}
                            className="flex items-center gap-3 cursor-pointer group justify-end min-w-0"
                          >
                            <span className="font-bold text-base text-white group-hover:text-indigo-400 transition-colors truncate text-right">
                              {extTeam?.nom || 'Équipe Extérieur'}
                            </span>
                            {extTeam?.logo_url ? (
                              <img src={extTeam.logo_url} className="w-10 h-10 object-contain group-hover:scale-110 transition-transform shrink-0" alt="" />
                            ) : (
                              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-xs">🛡️</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {tab === 'buteurs' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">🏅 Statistiques Individuelles</h2>
                <p className="text-xs text-slate-400">Performances enregistrées sur la saison sélectionnée</p>
              </div>

              <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-slate-400 pl-2">Saison :</span>
                <select
                  value={seasonFilter}
                  onChange={(e) => {
                    const s = parseInt(e.target.value, 10);
                    setSeasonFilter(s);
                    localStorage.setItem(`local_season_${currentUser.email}`, s);
                  }}
                  className="bg-slate-900 border border-slate-700 text-indigo-400 font-bold text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {availableSeasons.map((s) => (
                    <option key={s} value={s}>{getSeasonLabel(s)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">⚽ Meilleurs Buteurs</h3>
                <div className="overflow-x-auto">
                  {topButeurs.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">Aucun buteur dans cette saison.</p>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                          <th className="py-3 px-2">#</th>
                          <th className="py-3 px-4">Joueur</th>
                          <th className="py-3 px-4 text-right">Buts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-sm">
                        {topButeurs.slice(0, 10).map((j, i) => (
                          <tr key={j.id} className="hover:bg-slate-800/30">
                            <td className="py-3 px-2 font-mono font-bold text-slate-500">{i + 1}</td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">
                                {j.nom} {j.numero && <span className="text-[10px] text-slate-400 font-mono">#{j.numero}</span>} {j.poste && <span className="text-[10px] text-indigo-400 font-bold">({j.poste})</span>}
                              </div>
                              <div className="text-xs text-slate-400">{j.teams?.nom}</div>
                            </td>
                            <td className="py-3 px-4 text-right font-extrabold text-amber-400 text-base">
                              {j.buts}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">🎯 Meilleurs Passeurs</h3>
                <div className="overflow-x-auto">
                  {topPasseurs.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">Aucune passe décisive dans cette saison.</p>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                          <th className="py-3 px-2">#</th>
                          <th className="py-3 px-4">Joueur</th>
                          <th className="py-3 px-4 text-right">Passes D.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-sm">
                        {topPasseurs.slice(0, 10).map((j, i) => (
                          <tr key={j.id} className="hover:bg-slate-800/30">
                            <td className="py-3 px-2 font-mono font-bold text-slate-500">{i + 1}</td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">
                                {j.nom} {j.numero && <span className="text-[10px] text-slate-400 font-mono">#{j.numero}</span>} {j.poste && <span className="text-[10px] text-indigo-400 font-bold">({j.poste})</span>}
                              </div>
                              <div className="text-xs text-slate-400">{j.teams?.nom}</div>
                            </td>
                            <td className="py-3 px-4 text-right font-extrabold text-indigo-400 text-base">
                              {j.passes_decisives}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'transferts' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">🔄 Marché des Transferts & Prêts</h2>
                  <p className="text-xs text-slate-400 mt-1">16 joueurs min, 28 joueurs max par club. Les prêts durent 1 saison.</p>
                </div>
              </div>

              <form onSubmit={handleTransferPlayer} className="space-y-5 max-w-2xl mt-4">
                <div className="grid grid-cols-2 gap-3 bg-slate-950 p-2 rounded-xl border border-slate-800 mb-2">
                  <button
                    type="button"
                    onClick={() => setTransferType('achat')}
                    className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
                      transferType === 'achat' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🤝 Transfert Définitif
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferType('pret')}
                    className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
                      transferType === 'pret' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📄 Prêt d'une Saison
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
                    1. Club de provenance
                  </label>
                  <select
                    value={transferFromTeamId}
                    onChange={handleFromTeamChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                    required
                  >
                    <option value="">-- Choisir l'équipe de départ --</option>
                    {availableSellerTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.nom} ({players.filter(p => String(p.equipe_id) === String(t.id)).length} joueurs)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1.5">
                    2. Joueur concerné
                  </label>
                  <select
                    value={transferPlayerId}
                    onChange={handlePlayerSelectChange}
                    disabled={!transferFromTeamId}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                    required
                  >
                    <option value="">-- Choisir le joueur --</option>
                    {availablePlayersForTransfer.map((p) => (
                      <option key={p.id} value={p.id}>#{p.numero || 10} {p.nom} - GEN: {p.general || 75} ({p.poste})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">
                      3. Club de destination
                    </label>
                    <select
                      value={transferToTeamId}
                      onChange={(e) => setTransferToTeamId(e.target.value)}
                      disabled={!transferPlayerId}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                      required
                    >
                      <option value="">-- Choisir la nouvelle équipe --</option>
                      {availableDestinationTeams.map((t) => (
                        <option key={t.id} value={t.id}>{t.nom}</option>
                      ))}
                    </select>
                  </div>

                  {transferType === 'achat' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Montant du transfert (€)
                      </label>
                      <input
                        type="number"
                        step="500000"
                        value={transferFee}
                        onChange={(e) => setTransferFee(e.target.value)}
                        disabled={!transferPlayerId}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                        required
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col justify-center">
                      <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">
                        Modalité de prêt
                      </label>
                      <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-emerald-400 font-bold">
                        ✓ Prêt gratuit (Retour fin de saison)
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={transferLoading || !transferFromTeamId || !transferPlayerId || !transferToTeamId}
                  className={`w-full text-white font-bold py-3 rounded-xl text-sm transition-all cursor-pointer shadow-lg ${
                    transferType === 'pret' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'
                  }`}
                >
                  {transferLoading ? 'Validation en cours...' : transferType === 'pret' ? '📄 Confirmer le Prêt' : '🤝 Confirmer le Transfert'}
                </button>
              </form>
            </div>

            {transfers.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4">📋 Historique des Mouvements</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                        <th className="py-3 px-4">Joueur</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Ancien Club</th>
                        <th className="py-3 px-4">Nouveau Club</th>
                        <th className="py-3 px-4 text-right">Montant</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-sm">
                      {transfers.slice(0, 20).map((t) => (
                        <tr key={t.id} className="hover:bg-slate-800/30">
                          <td className="py-3.5 px-4 font-bold text-white">{t.players?.nom || 'Joueur inconnu'}</td>
                          <td className="py-3.5 px-4">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                              t.type === 'pret' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            }`}>
                              {t.type === 'pret' ? 'Prêt' : 'Transfert'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-rose-400 font-semibold">{t.old_team?.nom || '-'}</td>
                          <td className="py-3.5 px-4 text-emerald-400 font-semibold">{t.new_team?.nom || '-'}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-300">
                            {t.type === 'pret' ? 'Prêt gratuit' : formatMoney(t.fee)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleCancelTransfer(t)}
                              className="bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                            >
                              ↩ Annuler
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'admin' && isAdmin && (
          <div className="space-y-6">
            <h2 className="text-2xl font-extrabold text-white">⚙️ Panneau d'Administration ({currentUser.email})</h2>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4">1. Créer une Équipe</h3>
                <form onSubmit={handleAddTeam} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Nom</label>
                    <input
                      type="text"
                      placeholder="Ex: Real Madrid"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Logo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files[0])}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300"
                    />
                  </div>
                  <button type="submit" disabled={uploading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-sm cursor-pointer">
                    {uploading ? 'Chargement...' : '+ Ajouter l\'équipe'}
                  </button>
                </form>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4">2. Ajouter un Joueur</h3>
                <form onSubmit={handleAddPlayer} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Équipe</label>
                    <select
                      value={newPlayer.equipe_id}
                      onChange={(e) => setNewPlayer({ ...newPlayer, equipe_id: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                      required
                    >
                      <option value="">-- Choisir l'équipe --</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.nom}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Nom du joueur</label>
                      <input
                        type="text"
                        placeholder="Ex: Kylian Mbappé"
                        value={newPlayer.nom}
                        onChange={(e) => setNewPlayer({ ...newPlayer, nom: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none"
                        required
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-slate-400 mb-1">N° Maillot</label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={newPlayer.numero}
                        onChange={(e) => setNewPlayer({ ...newPlayer, numero: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white text-center font-bold"
                        required
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Poste</label>
                      <select
                        value={newPlayer.poste}
                        onChange={(e) => setNewPlayer({ ...newPlayer, poste: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                      >
                        {POSITIONS_LIST.map((pos, idx) => (
                          pos.disabled ? (
                            <option key={idx} disabled className="font-bold text-indigo-400 bg-slate-900">{pos.label}</option>
                          ) : (
                            <option key={pos.value} value={pos.value}>{pos.label}</option>
                          )
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Général (45-99)</label>
                      <input
                        type="number"
                        min="40"
                        max="99"
                        value={newPlayer.general}
                        onChange={(e) => {
                          const g = parseInt(e.target.value, 10) || 75;
                          setNewPlayer({ ...newPlayer, general: g, valeur: calculateMarketValue(g, newPlayer.age) });
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Âge</label>
                      <input
                        type="number"
                        min="15"
                        max="45"
                        value={newPlayer.age}
                        onChange={(e) => {
                          const a = parseInt(e.target.value, 10) || 22;
                          setNewPlayer({ ...newPlayer, age: a, valeur: calculateMarketValue(newPlayer.general, a) });
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Valeur (€)</label>
                      <input
                        type="number"
                        step="100000"
                        value={newPlayer.valeur}
                        onChange={(e) => setNewPlayer({ ...newPlayer, valeur: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-emerald-400 font-mono font-bold"
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-sm mt-2 cursor-pointer">
                    + Ajouter le joueur ({formatMoney(newPlayer.valeur)})
                  </button>
                </form>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">🔄 3. Gestion des Saisons</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    Réinitialiser (🔄) remet votre partie locale à zéro. Lancer la saison suivante (🚀) conserve vos effectifs et rappelle les joueurs prêtés.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartNewSeason(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-3 rounded-xl text-sm transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span>🔄</span> Réinitialiser Saison 1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartNewSeason(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-extrabold px-6 py-3 rounded-xl text-sm transition-all shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <span>🚀</span> Lancer la Saison Suivante
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODALE MERCATO */}
      {mercatoReport && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button type="button" onClick={() => setMercatoReport(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl cursor-pointer">✕</button>
            <div className="text-center mb-5 pb-3 border-b border-slate-800">
              <div className="inline-block bg-indigo-600 text-white p-2.5 rounded-2xl text-xl mb-2">
                {mercatoReport.isSummer ? '☀️' : '❄️'}
              </div>
              <h3 className="text-xl font-black text-white">{mercatoReport.title} EN DIRECT</h3>
              <p className="text-xs text-indigo-400 font-semibold mt-0.5">
                {mercatoReport.transfers.length} mouvements officiels • {mercatoReport.seasonLabel}
              </p>
            </div>

            <div className="overflow-y-auto space-y-3 max-h-96 pr-1">
              {mercatoReport.transfers.map((t) => (
                <div key={t.id} className="bg-slate-950/80 border border-slate-800/90 p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-900 text-indigo-300 border border-slate-800">{t.poste || 'MC'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-white">{t.nom}</p>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">{t.general} GEN</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          t.type.includes('Prêt') ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300'
                        }`}>
                          {t.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 italic mt-0.5">{t.reason}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                    <span className="text-rose-400 font-bold text-xs">{t.oldTeam}</span>
                    <span className="text-slate-500">➜</span>
                    <span className="text-emerald-400 font-bold text-xs">{t.newTeam}</span>
                    <span className="text-xs font-black font-mono px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-300">
                      {t.fee > 0 ? formatMoney(t.fee) : 'Prêt gratuit'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => setMercatoReport(null)} className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm cursor-pointer">
              Fermer le Point Mercato
            </button>
          </div>
        </div>
      )}

      {/* MODALE ÉVOLUTION */}
      {evolutionReport && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button type="button" onClick={() => setEvolutionReport(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl cursor-pointer">✕</button>
            <div className="text-center mb-4 pb-3 border-b border-slate-800">
              <div className="inline-block bg-indigo-600 text-white p-2 rounded-xl text-lg mb-2">📈</div>
              <h3 className="text-lg font-black text-white">Rapport d'Évolution des Notes</h3>
              <p className="text-xs text-slate-400 mt-0.5">Performances sur les <strong className="text-indigo-400">{evolutionReport.journeesLabel}</strong> ({evolutionReport.seasonLabel})</p>
            </div>

            <div className="overflow-y-auto space-y-2.5 max-h-96 pr-1">
              {evolutionReport.players.map((p) => (
                <div key={p.id} className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-2 py-1 rounded bg-slate-900 text-indigo-400 border border-slate-800">{p.poste || 'MC'}</span>
                    <div>
                      <p className="text-sm font-bold text-white">{p.nom}</p>
                      <p className="text-[11px] text-slate-400">{p.teamName} {p.buts > 0 && `• ⚽ ${p.buts}`} {p.passes > 0 && `• 🎯 ${p.passes}`}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs text-slate-500 font-mono line-through mr-1.5">{p.oldGen}</span>
                      <span className="text-base font-black text-white font-mono">{p.newGen}</span>
                    </div>
                    <span className={`text-xs font-black font-mono px-2.5 py-1 rounded-xl border ${p.delta > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                      {p.delta > 0 ? `+${p.delta}` : p.delta}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => setEvolutionReport(null)} className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm cursor-pointer">
              Continuer
            </button>
          </div>
        </div>
      )}

      {/* MODALE TACTIQUE */}
      {selectedLineupTeam && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl relative max-h-[96vh] flex flex-col overflow-y-auto">
            <button type="button" onClick={() => setSelectedLineupTeam(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl cursor-pointer z-10">✕</button>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-3">
                {selectedLineupTeam.logo_url ? (
                  <img src={selectedLineupTeam.logo_url} className="w-11 h-11 object-contain rounded-full bg-slate-950 p-1" alt="" />
                ) : (
                  <div className="w-11 h-11 bg-slate-950 rounded-full flex items-center justify-center text-lg">🛡️</div>
                )}
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">{selectedLineupTeam.nom}</h3>
                  <p className="text-[10px] text-slate-400">Cliquez sur 2 joueurs pour échanger leurs places</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[9px] uppercase font-extrabold text-slate-400 block">Note du 11</span>
                <span className="text-base font-black text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg">
                  {pitchAvgGen} GEN
                </span>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                <span>📋</span> Dispositif
              </span>
              <select
                value={currentFormation}
                onChange={(e) => handleFormationChange(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white font-bold text-xs rounded-lg px-3 py-1.5 focus:outline-none"
              >
                {Object.keys(FORMATIONS).map(fmt => (
                  <option key={fmt} value={fmt}>{FORMATIONS[fmt].name}</option>
                ))}
              </select>
            </div>

            <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl border border-emerald-600/40 bg-gradient-to-b from-emerald-700 via-emerald-600 to-emerald-800 p-4 min-h-[470px] flex flex-col justify-between select-none">
              <div className="absolute inset-2 border-2 border-white/25 rounded-xl pointer-events-none"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border-2 border-white/25 rounded-full pointer-events-none"></div>
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/25 pointer-events-none"></div>

              <div className="relative z-10 flex justify-around items-center pt-2">
                {pitchATT.map((p, idx) => (
                  <PitchPlayerSlot key={p?.id || idx} player={p} globalIndex={1 + formationConfig.def + formationConfig.mid + idx} />
                ))}
              </div>

              <div className="relative z-10 flex justify-around items-center py-2">
                {pitchMID.map((p, idx) => (
                  <PitchPlayerSlot key={p?.id || idx} player={p} globalIndex={1 + formationConfig.def + idx} />
                ))}
              </div>

              <div className="relative z-10 flex justify-around items-center py-2">
                {pitchDEF.map((p, idx) => (
                  <PitchPlayerSlot key={p?.id || idx} player={p} globalIndex={1 + idx} />
                ))}
              </div>

              <div className="relative z-10 flex justify-center items-center pb-2">
                {pitchGK.map((p) => (
                  <PitchPlayerSlot key={p?.id || 'gk'} player={p} globalIndex={0} />
                ))}
              </div>
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={handleSaveLineup}
                disabled={savingLineup}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-extrabold py-2.5 rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <span>💾</span> {savingLineup ? 'Enregistrement...' : 'Sauvegarder la Composition'}
              </button>
            </div>

            {/* BANC DES REMPLAÇANTS */}
            <div className="mt-4 bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">🪑 Banc des Remplaçants ({teamBenchPlayers.length})</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {teamBenchPlayers.map((j, bIdx) => (
                  <div
                    key={j.id}
                    onClick={() => handleSelectSlot('bench', bIdx)}
                    className="px-2.5 py-2 rounded-xl flex items-center justify-between cursor-pointer bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[10px] font-mono font-black text-amber-400 shrink-0">#{j.numero || 10}</span>
                      <span className="text-[10px] bg-indigo-600 text-white font-extrabold px-1.5 py-0.5 rounded shrink-0">
                        {j.poste || 'MC'}
                      </span>
                      <span className="text-xs font-semibold text-slate-200 truncate">{j.nom}</span>
                    </div>
                    <span className="text-[11px] font-black text-emerald-400 font-mono ml-2 shrink-0">{j.general || 75} GEN</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE EFFECTIF */}
      {selectedTeam && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative">
            <button type="button" onClick={() => setSelectedTeam(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl cursor-pointer">✕</button>
            <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-4">
                {selectedTeam.logo_url ? (
                  <img src={selectedTeam.logo_url} className="w-14 h-14 object-contain rounded-full bg-slate-950 p-1" alt="" />
                ) : (
                  <div className="w-14 h-14 bg-slate-950 rounded-full flex items-center justify-center text-xl">🛡️</div>
                )}
                <div>
                  <h3 className="text-xl font-extrabold text-white">{selectedTeam.nom}</h3>
                  <p className="text-xs text-indigo-400 font-semibold">{teamRoster.length} joueurs dans l'effectif</p>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={() => setEditingTeamLogo(selectedTeam)}
                  className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                >
                  📷 Modifier le Logo
                </button>
              )}
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Joueur</th>
                    <th className="py-2.5 px-3">Statut</th>
                    <th className="py-2.5 px-3">Poste</th>
                    <th className="py-2.5 px-3 text-center">GEN</th>
                    <th className="py-2.5 px-3 text-center">Âge</th>
                    <th className="py-2.5 px-3 text-center">Buts</th>
                    <th className="py-2.5 px-3 text-center">Passes</th>
                    <th className="py-2.5 px-3 text-right">Valeur</th>
                    {isAdmin && <th className="py-2.5 px-3 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm">
                  {teamRoster.map((j) => {
                    const status = getPlayerStatusAt(j.id, journeeFilter, seasonFilter, matchEvents);

                    return (
                      <tr key={j.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-mono font-bold text-amber-400">#{j.numero || 10}</td>
                        <td className="py-3 px-3 font-semibold text-white">
                          {j.nom}
                          {j.is_loan && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded ml-2 font-bold">En prêt</span>}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-black ${status.badgeClass}`}>
                            {status.badgeText}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-indigo-300 font-bold">{j.poste || 'N/A'}</td>
                        <td className="py-3 px-3 text-center font-extrabold text-emerald-400">{j.general || 75}</td>
                        <td className="py-3 px-3 text-center text-slate-300 font-medium">{j.age || '-'} ans</td>
                        <td className="py-3 px-3 text-center text-amber-400 font-bold">⚽ {j.buts}</td>
                        <td className="py-3 px-3 text-center text-indigo-400 font-bold">🎯 {j.passes_decisives}</td>
                        <td className="py-3 px-3 text-right font-mono text-xs text-slate-300">{formatMoney(j.valeur_marchande)}</td>
                        {isAdmin && (
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => setEditingPlayer(j)} className="bg-amber-500/20 hover:bg-amber-600 text-amber-300 hover:text-white p-1.5 rounded-lg text-xs cursor-pointer">✏️</button>
                              <button onClick={() => handleDeletePlayer(j.id, j.nom)} className="bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white p-1.5 rounded-lg text-xs cursor-pointer">🗑️</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODALE LOGO */}
      {editingTeamLogo && isAdmin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button type="button" onClick={() => { setEditingTeamLogo(null); setNewLogoFile(null); }} className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl cursor-pointer">✕</button>
            <h3 className="text-lg font-bold text-white mb-2">📷 Modifier le Logo</h3>
            <p className="text-xs text-slate-400 mb-4">Équipe : <span className="font-bold text-indigo-400">{editingTeamLogo.nom}</span></p>

            <form onSubmit={handleUpdateTeamLogo} className="space-y-4">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setNewLogoFile(e.target.files[0])}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300"
                required
              />
              <button type="submit" disabled={logoUpdating || !newLogoFile} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm cursor-pointer">
                {logoUpdating ? 'Mise à jour...' : 'Sauvegarder le Logo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODALE ÉDITION JOUEUR */}
      {editingPlayer && isAdmin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button type="button" onClick={() => setEditingPlayer(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl cursor-pointer">✕</button>
            <h3 className="text-lg font-bold text-white mb-4">✏️ Modifier {editingPlayer.nom}</h3>

            <form onSubmit={handleUpdatePlayer} className="space-y-3">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-8">
                  <label className="block text-xs text-slate-400 mb-1">Nom</label>
                  <input
                    type="text"
                    value={editingPlayer.nom || ''}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, nom: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                    required
                  />
                </div>
                <div className="col-span-4">
                  <label className="block text-xs text-slate-400 mb-1">N°</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={editingPlayer.numero ?? 10}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, numero: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white text-center font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Poste</label>
                <select
                  value={editingPlayer.poste || 'MC'}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, poste: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                >
                  {POSITIONS_LIST.map((pos, idx) => (
                    pos.disabled ? <option key={idx} disabled className="font-bold text-indigo-400">{pos.label}</option> : <option key={pos.value} value={pos.value}>{pos.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Général (45-99)</label>
                  <input
                    type="number"
                    min="40"
                    max="99"
                    value={editingPlayer.general ?? 75}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, general: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Âge</label>
                  <input
                    type="number"
                    min="15"
                    max="45"
                    value={editingPlayer.age ?? 22}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, age: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Valeur marchande (€)</label>
                <input
                  type="number"
                  step="500000"
                  value={editingPlayer.valeur_marchande || ''}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, valeur_marchande: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-emerald-400 font-mono font-bold"
                />
              </div>

              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm mt-2 cursor-pointer">
                Enregistrer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODALE DÉTAILS MATCH */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col overflow-y-auto">
            <button type="button" onClick={() => setSelectedMatch(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl cursor-pointer">✕</button>
            <h3 className="text-lg font-extrabold text-white text-center mb-1">Détails de la Rencontre</h3>
            <p className="text-xs text-slate-400 text-center mb-4">{getSeasonLabel(selectedMatch.saison || 1)} - Journée {selectedMatch.journee}</p>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-2 mb-6">
              <div className="flex items-center justify-end gap-3 flex-1 min-w-0">
                <span className="font-bold text-white text-sm sm:text-base truncate text-right">
                  {selectedMatch.dom?.nom}
                </span>
                {selectedMatch.dom?.logo_url ? (
                  <img src={selectedMatch.dom.logo_url} className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0" alt="" />
                ) : (
                  <span className="text-xl shrink-0">🛡️</span>
                )}
              </div>

              <div className="shrink-0 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl font-mono font-black text-xl sm:text-2xl text-emerald-400">
                {selectedMatch.score_domicile ?? 0} - {selectedMatch.score_exterieur ?? 0}
              </div>

              <div className="flex items-center justify-start gap-3 flex-1 min-w-0">
                {selectedMatch.ext?.logo_url ? (
                  <img src={selectedMatch.ext.logo_url} className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0" alt="" />
                ) : (
                  <span className="text-xl shrink-0">🛡️</span>
                )}
                <span className="font-bold text-white text-sm sm:text-base truncate text-left">
                  {selectedMatch.ext?.nom}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                <span className="text-xs font-extrabold text-indigo-400 uppercase">{selectedMatch.dom?.nom}</span>
                <div className="space-y-2 max-h-60 overflow-y-auto mt-2">
                  {homeEvents.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-4 text-center italic">Aucun événement</p>
                  ) : (
                    homeEvents.map(ev => (
                      <div key={ev.id} className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-xl text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-slate-400 text-[10px] shrink-0">{ev.minute ? `${ev.minute}'` : "45'"}</span>
                          <span className="font-semibold text-white truncate">{ev.player_nom}</span>
                        </div>
                        <div className="shrink-0 ml-2">
                          {renderEventBadge(ev)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                <span className="text-xs font-extrabold text-indigo-400 uppercase text-right block">{selectedMatch.ext?.nom}</span>
                <div className="space-y-2 max-h-60 overflow-y-auto mt-2">
                  {awayEvents.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-4 text-center italic">Aucun événement</p>
                  ) : (
                    awayEvents.map(ev => (
                      <div key={ev.id} className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-xl text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-slate-400 text-[10px] shrink-0">{ev.minute ? `${ev.minute}'` : "45'"}</span>
                          <span className="font-semibold text-white truncate">{ev.player_nom}</span>
                        </div>
                        <div className="shrink-0 ml-2">
                          {renderEventBadge(ev)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
