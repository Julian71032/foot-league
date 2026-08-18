import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

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

const FORMATIONS = {
  '4-3-3': { name: '4-3-3 (Classique)', def: 4, mid: 3, att: 3 },
  '4-4-2': { name: '4-4-2 (Équilibré)', def: 4, mid: 4, att: 2 },
  '4-2-3-1': { name: '4-2-3-1 (Offensif)', def: 4, mid: 5, att: 1 },
  '3-5-2': { name: '3-5-2 (Pistons)', def: 3, mid: 5, att: 2 },
  '5-4-1': { name: '5-4-1 (Défensif)', def: 5, mid: 4, att: 1 },
  '3-4-3': { name: '3-4-3 (Ultra-Offensif)', def: 3, mid: 4, att: 3 }
};

export default function App() {
  // --- AUTHENTIFICATION ---
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPseudo, setAuthPseudo] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // --- APP STATE ---
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

  // Modales
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedMatchEvents, setSelectedMatchEvents] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);

  // MODALE LOGO
  const [editingTeamLogo, setEditingTeamLogo] = useState(null);
  const [newLogoFile, setNewLogoFile] = useState(null);
  const [logoUpdating, setLogoUpdating] = useState(false);

  // COMPOSITION TACTIQUE
  const [selectedLineupTeam, setSelectedLineupTeam] = useState(null);
  const [currentFormation, setCurrentFormation] = useState('4-3-3');
  const [teamLineupPlayers, setTeamLineupPlayers] = useState([]);
  const [teamBenchPlayers, setTeamBenchPlayers] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [savingLineup, setSavingLineup] = useState(false);

  // Formulaires Admin & Scores
  const [scoresInput, setScoresInput] = useState({});
  const [newTeamName, setNewTeamName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ nom: '', equipe_id: '', numero: 10, general: 75, valeur: 10000000, age: 22, poste: 'MC' });
  const [generatingSchedule, setGeneratingSchedule] = useState(false);

  // Transferts
  const [transferFromTeamId, setTransferFromTeamId] = useState('');
  const [transferPlayerId, setTransferPlayerId] = useState('');
  const [transferToTeamId, setTransferToTeamId] = useState('');
  const [transferFee, setTransferFee] = useState(10000000);
  const [transferLoading, setTransferLoading] = useState(false);

  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  function showNotif(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  }

  async function fetchUserProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setUserProfile(data);
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthLoading(true);

    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: { data: { pseudo: authPseudo } }
      });
      if (error) showNotif(`Erreur : ${error.message}`);
      else showNotif("Compte créé ! Connexion en cours...");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) showNotif(`Erreur : ${error.message}`);
      else showNotif("Bon retour parmi nous !");
    }
    setAuthLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    showNotif("Déconnexion réussie.");
  }

  async function fetchData() {
    const { data: dataTeams } = await supabase.from('teams').select('*');
    if (dataTeams) setTeams(dataTeams);

    const { data: dataPlayers } = await supabase.from('players').select('*, teams(nom, logo_url)');
    if (dataPlayers) setPlayers(dataPlayers);

    let { data: userMatches } = await supabase
      .from('matches')
      .select('*, dom:teams!equipe_domicile_id(*), ext:teams!equipe_exterieur_id(*)')
      .eq('user_id', session.user.id)
      .order('journee', { ascending: true });

    if (userMatches) {
      setMatches(userMatches);
      const maxS = Math.max(...userMatches.map(m => m.saison || 1), 1);
      setSeasonFilter(prev => Math.max(prev, maxS));
    }

    const { data: dataEvents } = await supabase.from('match_events').select('*').eq('user_id', session.user.id);
    if (dataEvents) setMatchEvents(dataEvents);

    const { data: dataTransfers } = await supabase
      .from('transfers')
      .select('*, players(nom), old_team:teams!old_team_id(nom), new_team:teams!new_team_id(nom)')
      .order('created_at', { ascending: false });
    if (dataTransfers) setTransfers(dataTransfers);
  }

  const getSortedTeamPlayers = (teamId) => {
    if (!teamId) return [];
    return playersWithStats
      .filter(p => p.equipe_id === teamId)
      .sort((a, b) => {
        const rankA = getPositionRank(a.poste);
        const rankB = getPositionRank(b.poste);
        if (rankA !== rankB) return rankA - rankB;
        return (b.general || 0) - (a.general || 0);
      });
  };

  function getTeamStarters(team) {
    if (!team) return [];
    const all = getSortedTeamPlayers(team.id);
    let savedIds = team.lineup_ids;
    if (typeof savedIds === 'string') {
      try { savedIds = JSON.parse(savedIds); } catch (e) { savedIds = []; }
    }
    if (Array.isArray(savedIds) && savedIds.length >= 11) {
      const map = new Map(all.map(p => [p.id, p]));
      const list = savedIds.map(id => map.get(id)).filter(Boolean);
      if (list.length >= 11) return list.slice(0, 11);
    }
    return all.slice(0, 11);
  }

  // --- MOTEUR PROBABILISTE DE BUTS / PASSES / CARTONS ---
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

  function pickGoalScorer(starters) {
    if (!starters || starters.length === 0) return null;
    const weighted = starters.map(p => {
      let w = 1;
      const pos = p.poste || 'MC';
      if (['BU', 'AT'].includes(pos)) w = 14;
      else if (['AD', 'AG', 'SA'].includes(pos)) w = 10;
      else if (['MOC', 'MD', 'MG'].includes(pos)) w = 5;
      else if (['MC', 'MDC'].includes(pos)) w = 2.5;
      else if (['DD', 'DG', 'DLD', 'DLG', 'DC'].includes(pos)) w = 1;
      else if (pos === 'G') w = 0.01;

      w *= Math.pow((p.general || 75) / 75, 1.5);
      return { player: p, weight: w };
    });

    const totalWeight = weighted.reduce((acc, item) => acc + item.weight, 0);
    let randomVal = Math.random() * totalWeight;
    for (const item of weighted) {
      if (randomVal < item.weight) return item.player;
      randomVal -= item.weight;
    }
    return starters[0];
  }

  function pickAssister(starters, scorer) {
    if (!starters || starters.length < 2) return null;
    const candidates = starters.filter(p => p.id !== scorer?.id);
    if (candidates.length === 0) return null;

    const weighted = candidates.map(p => {
      let w = 1;
      const pos = p.poste || 'MC';
      if (['MOC', 'MC', 'MD', 'MG'].includes(pos)) w = 12;
      else if (['AD', 'AG', 'SA'].includes(pos)) w = 10;
      else if (['DD', 'DG', 'DLD', 'DLG'].includes(pos)) w = 6;
      else if (['BU', 'AT'].includes(pos)) w = 4;
      else if (['MDC', 'DC'].includes(pos)) w = 2;
      else if (pos === 'G') w = 0.1;

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

  function pickCardPlayer(starters) {
    if (!starters || starters.length === 0) return null;
    const weighted = starters.map(p => {
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
    return starters[0];
  }

  // --- SIMULATION AUTOMATIQUE D'UNE JOURNÉE ---
  async function handleSimulateJournee() {
    const currentJourneeMatches = seasonMatches.filter(m => m.journee === parseInt(journeeFilter, 10));
    if (currentJourneeMatches.length === 0) {
      showNotif("Aucun match à simuler pour cette journée.");
      return;
    }

    const unplayedCount = currentJourneeMatches.filter(m => m.statut !== 'terminé').length;
    const confirmText = unplayedCount === 0
      ? `Tous les matchs de la Journée ${journeeFilter} sont déjà joués. Voulez-vous re-simuler cette journée ?`
      : `Voulez-vous simuler automatiquement les ${currentJourneeMatches.length} matchs de la Journée ${journeeFilter} selon les notes GÉN des effectifs ?`;

    if (!window.confirm(confirmText)) return;

    setSimulating(true);

    try {
      const matchUpdates = [];
      const newEvents = [];
      const matchIdsToClear = currentJourneeMatches.map(m => m.id);

      for (const mId of matchIdsToClear) {
        await supabase.from('match_events').delete().eq('match_id', mId);
      }

      for (const m of currentJourneeMatches) {
        const domTeam = teams.find(t => t.id === m.equipe_domicile_id);
        const extTeam = teams.find(t => t.id === m.equipe_exterieur_id);

        const domStarters = getTeamStarters(domTeam);
        const extStarters = getTeamStarters(extTeam);

        const domGen = domStarters.length > 0 
          ? domStarters.reduce((acc, p) => acc + (p.general || 75), 0) / domStarters.length 
          : 75;
        const extGen = extStarters.length > 0 
          ? extStarters.reduce((acc, p) => acc + (p.general || 75), 0) / extStarters.length 
          : 75;

        const diff = (domGen + 1.5) - extGen;

        const domLambda = Math.max(0.3, Math.min(4.5, 1.45 + (diff * 0.12)));
        const extLambda = Math.max(0.2, Math.min(4.0, 1.10 - (diff * 0.10)));

        const scoreDom = simulateGoals(domLambda);
        const scoreExt = simulateGoals(extLambda);

        matchUpdates.push({
          id: m.id,
          score_domicile: scoreDom,
          score_exterieur: scoreExt,
          statut: 'terminé'
        });

        // Buteurs & Passeurs Domicile
        for (let i = 0; i < scoreDom; i++) {
          const scorer = pickGoalScorer(domStarters);
          const minute = Math.floor(Math.random() * 90) + 1;
          if (scorer) {
            newEvents.push({
              match_id: m.id,
              player_id: scorer.id,
              type: 'but',
              minute: minute,
              saison: m.saison || 1,
              user_id: session.user.id
            });
            if (Math.random() < 0.75) {
              const assister = pickAssister(domStarters, scorer);
              if (assister) {
                newEvents.push({
                  match_id: m.id,
                  player_id: assister.id,
                  type: 'passe',
                  minute: minute,
                  saison: m.saison || 1,
                  user_id: session.user.id
                });
              }
            }
          }
        }

        // Buteurs & Passeurs Extérieur
        for (let i = 0; i < scoreExt; i++) {
          const scorer = pickGoalScorer(extStarters);
          const minute = Math.floor(Math.random() * 90) + 1;
          if (scorer) {
            newEvents.push({
              match_id: m.id,
              player_id: scorer.id,
              type: 'but',
              minute: minute,
              saison: m.saison || 1,
              user_id: session.user.id
            });
            if (Math.random() < 0.75) {
              const assister = pickAssister(extStarters, scorer);
              if (assister) {
                newEvents.push({
                  match_id: m.id,
                  player_id: assister.id,
                  type: 'passe',
                  minute: minute,
                  saison: m.saison || 1,
                  user_id: session.user.id
                });
              }
            }
          }
        }

        // Cartons Jaunes / Rouges
        const numYellowDom = Math.random() < 0.65 ? Math.floor(Math.random() * 3) + 1 : 0;
        for (let y = 0; y < numYellowDom; y++) {
          const carded = pickCardPlayer(domStarters);
          if (carded) {
            newEvents.push({
              match_id: m.id,
              player_id: carded.id,
              type: 'carton_jaune',
              minute: Math.floor(Math.random() * 88) + 2,
              saison: m.saison || 1,
              user_id: session.user.id
            });
          }
        }
        const numYellowExt = Math.random() < 0.65 ? Math.floor(Math.random() * 3) + 1 : 0;
        for (let y = 0; y < numYellowExt; y++) {
          const carded = pickCardPlayer(extStarters);
          if (carded) {
            newEvents.push({
              match_id: m.id,
              player_id: carded.id,
              type: 'carton_jaune',
              minute: Math.floor(Math.random() * 88) + 2,
              saison: m.saison || 1,
              user_id: session.user.id
            });
          }
        }
      }

      for (const u of matchUpdates) {
        await supabase
          .from('matches')
          .update({ score_domicile: u.score_domicile, score_exterieur: u.score_exterieur, statut: 'terminé' })
          .eq('id', u.id);
      }

      if (newEvents.length > 0) {
        await supabase.from('match_events').insert(newEvents);
      }

      showNotif(`Journée ${journeeFilter} simulée avec succès !`);
      await fetchData();
    } catch (err) {
      showNotif(`Erreur : ${err.message}`);
    }

    setSimulating(false);
  }

  // --- CALENDRIER ROUND ROBIN ---
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
      equipe_domicile_id: m.equipe_exterieur_id,
      equipe_exterieur_id: m.equipe_domicile_id,
      journee: m.journee + numRounds,
      saison: seasonNum,
      statut: 'à venir',
      user_id: userId
    }));

    return [...allerMatches, ...retourMatches];
  }

  async function handleStartNewSeason(isNextSeason = false) {
    if (!teams || teams.length < 2) {
      showNotif("Il doit y avoir au moins 2 équipes créées pour lancer une saison.");
      return;
    }

    const currentMaxSeason = matches.length > 0 ? Math.max(...matches.map(m => m.saison || 1), 1) : 1;
    const targetSeason = isNextSeason ? currentMaxSeason + 1 : currentMaxSeason;
    const seasonLabel = getSeasonLabel(targetSeason);

    const totalJournees = (teams.length % 2 === 0 ? teams.length - 1 : teams.length) * 2;
    const totalMatchs = teams.length * (teams.length - 1);

    const confirmMsg = isNextSeason
      ? `Voulez-vous lancer la ${seasonLabel} ?\n\n- ${teams.length} Équipes\n- ${totalJournees} Journées Aller-Retour\n- ${totalMatchs} Matchs programmés\n\nL'historique des saisons précédentes restera consultable.`
      : `Voulez-vous générer le calendrier pour la ${seasonLabel} ?\n\n- ${teams.length} Équipes\n- ${totalJournees} Journées Aller-Retour\n- ${totalMatchs} Matchs programmés`;

    if (!window.confirm(confirmMsg)) return;

    setGeneratingSchedule(true);

    try {
      if (!isNextSeason) {
        await supabase.from('match_events').delete().eq('user_id', session.user.id).eq('saison', targetSeason);
        await supabase.from('matches').delete().eq('user_id', session.user.id).eq('saison', targetSeason);
      }

      const fixtures = buildRoundRobinFixtures(teams, session.user.id, targetSeason);
      const { error } = await supabase.from('matches').insert(fixtures);

      if (error) {
        showNotif(`Erreur : ${error.message}`);
      } else {
        showNotif(`${seasonLabel} lancée avec succès !`);
        setSeasonFilter(targetSeason);
        setJourneeFilter(1);
        await fetchData();
      }
    } catch (err) {
      showNotif(`Erreur : ${err.message}`);
    }

    setGeneratingSchedule(false);
  }

  const seasonMatches = matches.filter(m => (m.saison || 1) === parseInt(seasonFilter, 10));
  const seasonEvents = matchEvents.filter(e => (e.saison || 1) === parseInt(seasonFilter, 10));

  const availableSeasons = Array.from(
    new Set([...matches.map(m => m.saison || 1), 1])
  ).sort((a, b) => a - b);

  const classement = teams.map(team => {
    let points = 0;
    let joues = 0;

    seasonMatches.forEach(m => {
      if (m.statut === 'terminé') {
        if (m.equipe_domicile_id === team.id) {
          joues++;
          if (m.score_domicile > m.score_exterieur) points += 3;
          else if (m.score_domicile === m.score_exterieur) points += 1;
        } else if (m.equipe_exterieur_id === team.id) {
          joues++;
          if (m.score_exterieur > m.score_domicile) points += 3;
          else if (m.score_domicile === m.score_exterieur) points += 1;
        }
      }
    });

    return { ...team, points, joues };
  }).sort((a, b) => b.points - a.points);

  const playersWithStats = players.map(p => {
    const buts = seasonEvents.filter(e => e.player_id === p.id && e.type === 'but').length;
    const passes = seasonEvents.filter(e => e.player_id === p.id && e.type === 'passe').length;
    return { ...p, buts, passes_decisives: passes };
  });

  const topButeurs = [...playersWithStats]
    .filter(j => j.buts > 0)
    .sort((a, b) => b.buts - a.buts);

  const topPasseurs = [...playersWithStats]
    .filter(j => j.passes_decisives > 0)
    .sort((a, b) => b.passes_decisives - a.passes_decisives);

  const availablePlayersForTransfer = players.filter(p => p.equipe_id === transferFromTeamId);
  const availableDestinationTeams = teams.filter(t => t.id !== transferFromTeamId);
  const selectedTransferPlayer = players.find(p => p.id === transferPlayerId);

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

    const selectedPlayer = players.find(p => p.id === transferPlayerId);
    if (!selectedPlayer) return;

    setTransferLoading(true);

    const { error: updateError } = await supabase
      .from('players')
      .update({
        equipe_id: transferToTeamId,
        valeur_marchande: parseInt(transferFee, 10)
      })
      .eq('id', transferPlayerId);

    if (updateError) {
      showNotif(`Erreur : ${updateError.message}`);
      setTransferLoading(false);
      return;
    }

    await supabase.from('transfers').insert([{
      player_id: transferPlayerId,
      old_team_id: transferFromTeamId,
      new_team_id: transferToTeamId,
      fee: parseInt(transferFee, 10),
      user_id: session.user.id
    }]);

    showNotif(`Transfert de ${selectedPlayer.nom} effectué avec succès !`);
    setTransferFromTeamId('');
    setTransferPlayerId('');
    setTransferToTeamId('');
    setTransferFee(10000000);
    setTransferLoading(false);
    fetchData();
  }

  async function handleDeletePlayer(playerId, playerNom) {
    if (!userProfile?.is_admin) return;
    if (!window.confirm(`Supprimer définitivement le joueur "${playerNom}" ?`)) return;

    await supabase.from('match_events').delete().eq('player_id', playerId);
    const { error } = await supabase.from('players').delete().eq('id', playerId);

    if (error) showNotif(`Erreur : ${error.message}`);
    else {
      showNotif(`Le joueur "${playerNom}" a été supprimé.`);
      fetchData();
    }
  }

  async function handleUpdatePlayer(e) {
    e.preventDefault();
    if (!userProfile?.is_admin || !editingPlayer) return;

    try {
      const { error } = await supabase
        .from('players')
        .update({
          nom: editingPlayer.nom,
          poste: editingPlayer.poste,
          numero: editingPlayer.numero ? parseInt(editingPlayer.numero, 10) : 10,
          general: editingPlayer.general ? parseInt(editingPlayer.general, 10) : 75,
          age: editingPlayer.age ? parseInt(editingPlayer.age, 10) : 22,
          valeur_marchande: editingPlayer.valeur_marchande ? parseInt(editingPlayer.valeur_marchande, 10) : 10000000
        })
        .eq('id', editingPlayer.id);

      if (error) showNotif(`Erreur : ${error.message}`);
      else {
        showNotif(`Joueur "${editingPlayer.nom}" mis à jour !`);
        setEditingPlayer(null);
        await fetchData();
      }
    } catch (err) {
      showNotif(`Erreur : ${err.message}`);
    }
  }

  async function handleUpdateTeamLogo(e) {
    e.preventDefault();
    if (!editingTeamLogo || !newLogoFile) return;

    setLogoUpdating(true);
    try {
      const logoUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(newLogoFile);
      });

      const { error } = await supabase
        .from('teams')
        .update({ logo_url: logoUrl })
        .eq('id', editingTeamLogo.id);

      if (error) showNotif(`Erreur : ${error.message}`);
      else {
        showNotif(`Logo de "${editingTeamLogo.nom}" modifié !`);
        setEditingTeamLogo(null);
        setNewLogoFile(null);
        fetchData();
      }
    } catch (err) {
      showNotif(`Erreur : ${err.message}`);
    }
    setLogoUpdating(false);
  }

  async function openMatchDetails(match) {
    setSelectedMatch(match);
    const { data } = await supabase
      .from('match_events')
      .select('*, players(id, nom, poste, numero, equipe_id)')
      .eq('match_id', match.id)
      .eq('user_id', session.user.id)
      .order('minute', { ascending: true });
    if (data) setSelectedMatchEvents(data);
  }

  function handleScoreInputChange(matchId, teamType, val) {
    setScoresInput(prev => ({ ...prev, [matchId]: { ...prev[matchId], [teamType]: val } }));
  }

  async function handleSaveMatchScore(match) {
    const matchScores = scoresInput[match.id] || {};
    const scoreDom = parseInt(matchScores.dom !== undefined ? matchScores.dom : match.score_domicile, 10);
    const scoreExt = parseInt(matchScores.ext !== undefined ? matchScores.ext : match.score_exterieur, 10);

    if (isNaN(scoreDom) || isNaN(scoreExt)) { showNotif("Saisissez un score valide."); return; }

    const domTeam = teams.find(t => t.id === match.equipe_domicile_id);
    const extTeam = teams.find(t => t.id === match.equipe_exterieur_id);
    const domStarters = getTeamStarters(domTeam);
    const extStarters = getTeamStarters(extTeam);

    await supabase.from('match_events').delete().eq('match_id', match.id);

    const newEvents = [];
    for (let i = 0; i < scoreDom; i++) {
      const scorer = pickGoalScorer(domStarters);
      const minute = Math.floor(Math.random() * 90) + 1;
      if (scorer) {
        newEvents.push({ match_id: match.id, player_id: scorer.id, type: 'but', minute, saison: match.saison || 1, user_id: session.user.id });
        if (Math.random() < 0.75) {
          const assister = pickAssister(domStarters, scorer);
          if (assister) newEvents.push({ match_id: match.id, player_id: assister.id, type: 'passe', minute, saison: match.saison || 1, user_id: session.user.id });
        }
      }
    }
    for (let i = 0; i < scoreExt; i++) {
      const scorer = pickGoalScorer(extStarters);
      const minute = Math.floor(Math.random() * 90) + 1;
      if (scorer) {
        newEvents.push({ match_id: match.id, player_id: scorer.id, type: 'but', minute, saison: match.saison || 1, user_id: session.user.id });
        if (Math.random() < 0.75) {
          const assister = pickAssister(extStarters, scorer);
          if (assister) newEvents.push({ match_id: match.id, player_id: assister.id, type: 'passe', minute, saison: match.saison || 1, user_id: session.user.id });
        }
      }
    }

    if (newEvents.length > 0) {
      await supabase.from('match_events').insert(newEvents);
    }

    const { error } = await supabase
      .from('matches')
      .update({ score_domicile: scoreDom, score_exterieur: scoreExt, statut: 'terminé' })
      .eq('id', match.id)
      .eq('user_id', session.user.id);

    if (error) showNotif(`Erreur : ${error.message}`);
    else {
      showNotif("Score et événements enregistrés !");
      fetchData();
    }
  }

  async function handleAddTeam(e) {
    e.preventDefault();
    if (!newTeamName || !userProfile?.is_admin) return;
    setUploading(true);
    let logoUrl = '';

    if (logoFile) {
      try {
        logoUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(logoFile);
        });
      } catch (err) {
        showNotif(`Erreur image : ${err.message}`);
        setUploading(false);
        return;
      }
    }

    const { error } = await supabase.from('teams').insert([{
      nom: newTeamName,
      logo_url: logoUrl,
      points: 0
    }]);
    setUploading(false);

    if (error) showNotif(`Erreur : ${error.message}`);
    else {
      showNotif(`Équipe "${newTeamName}" créée !`);
      setNewTeamName(''); setLogoFile(null); fetchData();
    }
  }

  async function handleAddPlayer(e) {
    e.preventDefault();
    if (!newPlayer.nom || !newPlayer.equipe_id || !userProfile?.is_admin) return;

    const { error } = await supabase.from('players').insert([{
      nom: newPlayer.nom,
      equipe_id: newPlayer.equipe_id,
      numero: parseInt(newPlayer.numero, 10) || 10,
      poste: newPlayer.poste,
      general: parseInt(newPlayer.general, 10),
      valeur_marchande: parseInt(newPlayer.valeur, 10),
      age: parseInt(newPlayer.age, 10)
    }]);

    if (error) showNotif(`Erreur : ${error.message}`);
    else {
      showNotif(`Joueur "${newPlayer.nom}" (#${newPlayer.numero || 10}) ajouté !`);
      setNewPlayer({ nom: '', equipe_id: newPlayer.equipe_id, numero: 10, general: 75, valeur: 10000000, age: 22, poste: 'MC' });
      fetchData();
    }
  }

  function formatMoney(amount) {
    if (!amount) return '0 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
  }

  const teamRoster = selectedTeam ? getSortedTeamPlayers(selectedTeam.id) : [];

  function openTeamLineup(team) {
    const fullTeam = teams.find(t => t.id === team.id) || team;
    setSelectedLineupTeam(fullTeam);
    setSelectedSlot(null);

    const allTeamPlayers = getSortedTeamPlayers(fullTeam.id);
    const savedFormation = fullTeam.formation || '4-3-3';
    setCurrentFormation(savedFormation);

    let savedIds = fullTeam.lineup_ids;
    if (typeof savedIds === 'string') {
      try { savedIds = JSON.parse(savedIds); } catch (e) { savedIds = []; }
    }

    if (Array.isArray(savedIds) && savedIds.length > 0) {
      const playerMap = new Map(allTeamPlayers.map(p => [p.id, p]));
      const savedStarters = [];
      const usedIds = new Set();

      savedIds.forEach(id => {
        if (playerMap.has(id)) {
          savedStarters.push(playerMap.get(id));
          usedIds.add(id);
        }
      });

      const remainingBench = allTeamPlayers.filter(p => !usedIds.has(p.id));

      if (savedStarters.length >= 11) {
        setTeamLineupPlayers(savedStarters.slice(0, 11));
        setTeamBenchPlayers([...savedStarters.slice(11), ...remainingBench]);
        return;
      }
    }

    buildLineupForFormation(allTeamPlayers, savedFormation);
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

    try {
      const { error } = await supabase
        .from('teams')
        .update({
          formation: currentFormation,
          lineup_ids: starterIds
        })
        .eq('id', selectedLineupTeam.id);

      if (error) {
        showNotif(`Erreur : ${error.message}`);
      } else {
        showNotif(`Composition de "${selectedLineupTeam.nom}" (${currentFormation}) sauvegardée !`);
        setTeams(prev => prev.map(t => t.id === selectedLineupTeam.id ? { ...t, formation: currentFormation, lineup_ids: starterIds } : t));
        setSelectedLineupTeam(prev => ({ ...prev, formation: currentFormation, lineup_ids: starterIds }));
        await fetchData();
      }
    } catch (err) {
      showNotif(`Erreur : ${err.message}`);
    }

    setSavingLineup(false);
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
      showNotif("Postes permutés ! Sauvegardez pour enregistrer.");
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

  // Séparation des événements pour la modale scindée (Domicile / Extérieur)
  const homeEvents = selectedMatch ? selectedMatchEvents.filter(ev => ev.players?.equipe_id === selectedMatch.equipe_domicile_id) : [];
  const awayEvents = selectedMatch ? selectedMatchEvents.filter(ev => ev.players?.equipe_id === selectedMatch.equipe_exterieur_id) : [];

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-block bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-500/30 mb-3 text-2xl">⚽</div>
            <h1 className="text-2xl font-black text-white tracking-tight">LIGUE DE FOOTBALL</h1>
            <p className="text-xs text-slate-400 mt-1">Connectez-vous pour retrouver votre carrière personnelle</p>
          </div>

          {notification && (
            <div className="bg-indigo-600/30 border border-indigo-500 text-indigo-200 text-xs p-3 rounded-xl mb-6 text-center font-semibold">
              {notification}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Pseudo</label>
                <input
                  type="text"
                  placeholder="Ex: CoachManager"
                  value={authPseudo}
                  onChange={(e) => setAuthPseudo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Email</label>
              <input
                type="email"
                placeholder="votre@email.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Mot de passe</label>
              <input
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              {authLoading ? 'Chargement...' : authMode === 'login' ? 'Se connecter' : 'Créer un compte'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="text-xs text-indigo-400 hover:underline font-semibold"
            >
              {authMode === 'login' ? "Pas de compte ? Inscrivez-vous" : "Déjà un compte ? Connectez-vous"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">⚽</div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white">LIGUE DE FOOTBALL</h1>
              <p className="text-xs text-slate-400 font-medium">
                Joueur : <span className="text-indigo-400 font-bold">{userProfile?.pseudo || session.user.email}</span>
                {userProfile?.is_admin && <span className="ml-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">ADMIN</span>}
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80">
              {[
                { id: 'classement', label: '🏆 Classement' },
                { id: 'matchs', label: '📅 Matchs' },
                { id: 'buteurs', label: '👟 Stats Joueurs' },
                { id: 'transferts', label: '🔄 Transferts' },
                ...(userProfile?.is_admin ? [{ id: 'admin', label: '⚙️ Admin' }] : []),
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    tab === item.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleLogout}
              className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold px-3 py-2.5 rounded-xl transition-all"
              title="Déconnexion"
            >
              🚪
            </button>
          </nav>
        </div>
      </header>

      {/* Notifications */}
      {notification && (
        <div className="max-w-md mx-auto mt-4 px-4">
          <div className="bg-indigo-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl text-center border border-indigo-400">
            {notification}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 mt-8">
        {/* 1. CLASSEMENT ÉQUIPES */}
        {tab === 'classement' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">🏆 Classement Général</h2>
                <span className="text-xs text-slate-400">💡 Clique sur une équipe pour voir son effectif complet</span>
              </div>

              {/* SÉLECTEUR DE SAISON */}
              <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-slate-400 pl-2">Saison :</span>
                <select
                  value={seasonFilter}
                  onChange={(e) => {
                    setSeasonFilter(parseInt(e.target.value, 10));
                    setJourneeFilter(1);
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
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Équipe</th>
                    <th className="py-3 px-4 text-center">MJ</th>
                    <th className="py-3 px-4 text-center">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {classement.map((eq, i) => (
                    <tr
                      key={eq.id}
                      onClick={() => setSelectedTeam(eq)}
                      className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-4 font-mono font-bold text-slate-400 group-hover:text-indigo-400">{i + 1}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {eq.logo_url ? (
                            <img src={eq.logo_url} alt="" className="w-8 h-8 object-contain rounded-full bg-slate-800 p-0.5" />
                          ) : (
                            <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-xs">🛡️</div>
                          )}
                          <span className="font-bold text-white group-hover:text-indigo-400 transition-colors">{eq.nom}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center text-slate-400 font-semibold">{eq.joues}</td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-block bg-indigo-500/10 text-indigo-400 font-extrabold px-3 py-1 rounded-full border border-indigo-500/20">
                          {eq.points} pts
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. MATCHS */}
        {tab === 'matchs' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">📅 Calendrier des Rencontres</h2>
                <p className="text-xs text-slate-400 mt-1">💡 Clique sur le bouton <strong>VS</strong> au milieu d'un match pour consulter les buteurs, passeurs et cartons de chaque équipe</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                {/* SÉLECTEUR DE SAISON */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 pl-1.5">Saison :</span>
                  <select
                    value={seasonFilter}
                    onChange={(e) => {
                      setSeasonFilter(parseInt(e.target.value, 10));
                      setJourneeFilter(1);
                    }}
                    className="bg-slate-900 border border-slate-700 text-indigo-400 font-bold text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {availableSeasons.map((s) => (
                      <option key={s} value={s}>{getSeasonLabel(s)}</option>
                    ))}
                  </select>
                </div>

                {/* SÉLECTEUR DE JOURNÉE */}
                <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium pl-2">Journée</span>
                  <input
                    type="number"
                    min="1"
                    max={maxJourneesCount}
                    value={journeeFilter}
                    onChange={(e) => setJourneeFilter(e.target.value)}
                    className="bg-slate-800 text-white font-bold w-14 px-2 py-1 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 text-center text-xs"
                  />
                  <span className="text-[11px] text-slate-500 pr-2">/ {maxJourneesCount}</span>
                </div>

                {/* BOUTON DE SIMULATION DE LA JOURNÉE BASÉ SUR LE GÉNÉRAL */}
                <button
                  type="button"
                  onClick={handleSimulateJournee}
                  disabled={simulating || seasonMatches.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer"
                  title="Simule tous les scores de la journée en calculant les probabilités selon le GÉN de chaque effectif"
                >
                  <span>⚡</span> {simulating ? 'Simulation...' : 'Simuler la Journée'}
                </button>

                {/* BOUTONS SAISONS */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStartNewSeason(false)}
                    disabled={generatingSchedule || teams.length < 2}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-2.5 py-2 rounded-xl transition-all cursor-pointer"
                    title="Regénérer le calendrier de cette saison"
                  >
                    🎲
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartNewSeason(true)}
                    disabled={generatingSchedule || teams.length < 2}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Lancer la saison suivante"
                  >
                    <span>🚀</span> Saison +1
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-1">
              {seasonMatches.filter((m) => m.journee === parseInt(journeeFilter, 10)).length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                  <p className="text-slate-400 font-medium text-sm mb-4">Aucun match programmé pour cette journée dans la {getSeasonLabel(seasonFilter)}.</p>
                  <button
                    onClick={() => handleStartNewSeason(false)}
                    disabled={generatingSchedule || teams.length < 2}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
                  >
                    🎲 Générer le Calendrier de la {getSeasonLabel(seasonFilter)}
                  </button>
                </div>
              ) : (
                seasonMatches
                  .filter((m) => m.journee === parseInt(journeeFilter, 10))
                  .map((m) => {
                    const currentDomInput = scoresInput[m.id]?.dom !== undefined ? scoresInput[m.id].dom : (m.score_domicile ?? '');
                    const currentExtInput = scoresInput[m.id]?.ext !== undefined ? scoresInput[m.id].ext : (m.score_exterieur ?? '');

                    return (
                      <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                        
                        {/* ÉQUIPE DOMICILE (CLIQUABLE -> COMPO) */}
                        <div 
                          onClick={() => openTeamLineup(m.dom)}
                          className="flex items-center gap-3 sm:w-5/12 justify-start w-full cursor-pointer group min-w-0"
                          title="Voir & modifier la composition (11 de départ)"
                        >
                          {m.dom?.logo_url ? (
                            <img src={m.dom.logo_url} className="w-10 h-10 object-contain group-hover:scale-110 transition-transform shrink-0" alt="" />
                          ) : (
                            <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-xs group-hover:bg-slate-700 shrink-0">🛡️</div>
                          )}
                          <span className="font-bold text-base text-white group-hover:text-indigo-400 transition-colors truncate">
                            {m.dom?.nom}
                          </span>
                        </div>

                        {/* CENTRE : INPUTS ET BOUTON VS FIXE CLIQUABLE (SCORE PROPRE SANS ÉCRASEMENT) */}
                        <div className="flex items-center justify-center gap-2 sm:gap-3 shrink-0 my-2 sm:my-0">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={currentDomInput}
                            onChange={(e) => handleScoreInputChange(m.id, 'dom', e.target.value)}
                            className="w-12 h-11 sm:w-14 sm:h-12 bg-slate-950 text-white font-mono font-black text-xl text-center rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />

                          {/* BOUTON FIXE "VS" QUI OUVRE LA FEUILLE DE MATCH */}
                          <button
                            type="button"
                            onClick={() => openMatchDetails(m)}
                            className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-black tracking-widest px-3.5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md active:scale-95 uppercase select-none"
                            title="Cliquer pour voir les buteurs, passeurs et cartons de chaque équipe"
                          >
                            VS
                          </button>

                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={currentExtInput}
                            onChange={(e) => handleScoreInputChange(m.id, 'ext', e.target.value)}
                            className="w-12 h-11 sm:w-14 sm:h-12 bg-slate-950 text-white font-mono font-black text-xl text-center rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />

                          <button
                            onClick={() => handleSaveMatchScore(m)}
                            className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold w-9 h-11 sm:w-10 sm:h-12 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center ml-1"
                            title="Enregistrer le score manuellement"
                          >
                            ✓
                          </button>
                        </div>

                        {/* ÉQUIPE EXTÉRIEURE (CLIQUABLE -> COMPO) */}
                        <div className="flex items-center gap-3 sm:w-5/12 justify-end w-full min-w-0">
                          <div 
                            onClick={() => openTeamLineup(m.ext)}
                            className="flex items-center gap-3 cursor-pointer group justify-end min-w-0"
                            title="Voir & modifier la composition (11 de départ)"
                          >
                            <span className="font-bold text-base text-white group-hover:text-indigo-400 transition-colors truncate text-right">
                              {m.ext?.nom}
                            </span>
                            {m.ext?.logo_url ? (
                              <img src={m.ext.logo_url} className="w-10 h-10 object-contain group-hover:scale-110 transition-transform shrink-0" alt="" />
                            ) : (
                              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-xs group-hover:bg-slate-700 shrink-0">🛡️</div>
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

        {/* 3. CLASSEMENT BUTEURS ET PASSEURS */}
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
                  onChange={(e) => setSeasonFilter(parseInt(e.target.value, 10))}
                  className="bg-slate-900 border border-slate-700 text-indigo-400 font-bold text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {availableSeasons.map((s) => (
                    <option key={s} value={s}>{getSeasonLabel(s)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* MEILLEURS BUTEURS */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">⚽ Vos Meilleurs Buteurs</h3>
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

              {/* MEILLEURS PASSEURS */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">🎯 Vos Meilleurs Passeurs</h3>
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

        {/* 4. MARCHE DES TRANSFERTS */}
        {tab === 'transferts' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">🔄 Marché des Transferts</h2>
              <p className="text-xs text-slate-400 mb-6">
                Sélectionnez le club d'origine, le joueur concerné, puis son club de destination.
              </p>

              <form onSubmit={handleTransferPlayer} className="space-y-5 max-w-2xl">
                <div>
                  <label className="block text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
                    1. Club de provenance
                  </label>
                  <select
                    value={transferFromTeamId}
                    onChange={handleFromTeamChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="">-- Choisir l'équipe de départ --</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.nom}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1.5">
                    2. Joueur à transférer
                  </label>
                  <select
                    value={transferPlayerId}
                    onChange={handlePlayerSelectChange}
                    disabled={!transferFromTeamId}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    required
                  >
                    <option value="">
                      {!transferFromTeamId
                        ? "-- Sélectionnez d'abord un club de provenance --"
                        : availablePlayersForTransfer.length === 0
                        ? "-- Aucun joueur dans ce club --"
                        : "-- Choisir le joueur --"}
                    </option>
                    {availablePlayersForTransfer.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.numero || 10} {p.nom} [{p.poste || 'N/A'}] - GEN: {p.general || 75} ({formatMoney(p.valeur_marchande)})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTransferPlayer && (
                  <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400">Joueur</p>
                      <p className="text-sm font-bold text-white">#{selectedTransferPlayer.numero || 10} {selectedTransferPlayer.nom} <span className="text-indigo-400 font-normal">({selectedTransferPlayer.poste || 'Poste non défini'})</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Valeur actuelle</p>
                      <p className="text-sm font-bold text-emerald-400">{formatMoney(selectedTransferPlayer.valeur_marchande)}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">
                      3. Club de destination
                    </label>
                    <select
                      value={transferToTeamId}
                      onChange={(e) => setTransferToTeamId(e.target.value)}
                      disabled={!transferPlayerId}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                      required
                    >
                      <option value="">-- Choisir la nouvelle équipe --</option>
                      {availableDestinationTeams.map((t) => (
                        <option key={t.id} value={t.id}>{t.nom}</option>
                      ))}
                    </select>
                  </div>

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
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={transferLoading || !transferFromTeamId || !transferPlayerId || !transferToTeamId}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 mt-2 cursor-pointer"
                >
                  {transferLoading ? 'Transfert en cours...' : '🤝 Confirmer le Transfert'}
                </button>
              </form>
            </div>

            {/* Historique des Transferts */}
            {transfers.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4">📋 Historique des Derniers Transferts</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                        <th className="py-3 px-4">Joueur</th>
                        <th className="py-3 px-4">Ancien Club</th>
                        <th className="py-3 px-4">Nouveau Club</th>
                        <th className="py-3 px-4 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-sm">
                      {transfers.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-800/30">
                          <td className="py-3.5 px-4 font-bold text-white">{t.players?.nom || 'Joueur inconnu'}</td>
                          <td className="py-3.5 px-4 text-rose-400 font-semibold">{t.old_team?.nom || '-'}</td>
                          <td className="py-3.5 px-4 text-emerald-400 font-semibold">{t.new_team?.nom || '-'}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-300">
                            {formatMoney(t.fee)}
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

        {/* 5. ADMIN (CRÉATEUR DE LIGUE) */}
        {tab === 'admin' && userProfile?.is_admin && (
          <div className="space-y-6">
            <h2 className="text-2xl font-extrabold text-white">⚙️ Panneau d'Administration (Créateur de Ligue)</h2>

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
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Logo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files[0])}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white"
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
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      required
                    >
                      <option value="">-- Choisir l'équipe --</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
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
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-slate-400 mb-1">N° Maillot</label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        placeholder="10"
                        value={newPlayer.numero}
                        onChange={(e) => setNewPlayer({ ...newPlayer, numero: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 text-center font-bold"
                        required
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Poste</label>
                      <select
                        value={newPlayer.poste}
                        onChange={(e) => setNewPlayer({ ...newPlayer, poste: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      >
                        {POSITIONS_LIST.map((pos, idx) => (
                          pos.disabled ? (
                            <option key={idx} disabled className="font-bold text-indigo-400 bg-slate-900">
                              {pos.label}
                            </option>
                          ) : (
                            <option key={pos.value} value={pos.value}>
                              {pos.label}
                            </option>
                          )
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Général</label>
                      <input
                        type="number"
                        min="40"
                        max="99"
                        value={newPlayer.general}
                        onChange={(e) => setNewPlayer({ ...newPlayer, general: e.target.value })}
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
                        onChange={(e) => setNewPlayer({ ...newPlayer, age: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Valeur (€)</label>
                      <input
                        type="number"
                        step="500000"
                        value={newPlayer.valeur}
                        onChange={(e) => setNewPlayer({ ...newPlayer, valeur: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                      />
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-sm mt-2 cursor-pointer">
                    + Ajouter le joueur
                  </button>
                </form>
              </div>
            </div>

            {/* SECTION 3 : GESTION DES SAISONS ADMIN */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🎲</span> 3. Gestion des Saisons & Calendriers
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    Chaque saison génère un calendrier complet Aller-Retour de championnat. Les saisons passées restent archivées et consultables.
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs font-semibold text-slate-400">
                    <span>🛡️ Équipes : <strong className="text-indigo-400">{teams.length}</strong></span>
                    <span>📅 Journées/Saison : <strong className="text-amber-400">{teams.length >= 2 ? (teams.length % 2 === 0 ? teams.length - 1 : teams.length) * 2 : 0}</strong></span>
                    <span>🏆 Saisons créées : <strong className="text-emerald-400">{availableSeasons.length}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartNewSeason(false)}
                    disabled={generatingSchedule || teams.length < 2}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-3 rounded-xl text-sm transition-all cursor-pointer"
                  >
                    Regénérer la Saison Active
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartNewSeason(true)}
                    disabled={generatingSchedule || teams.length < 2}
                    className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:bg-slate-800 disabled:text-slate-600 text-white font-extrabold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <span>🚀</span> Lancer la Saison Suivante
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- MODALE 1 : TERRAIN TACTIQUE INTERACTIF AVEC BOUTON SAUVEGARDER --- */}
      {selectedLineupTeam && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl relative max-h-[96vh] flex flex-col overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedLineupTeam(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl cursor-pointer z-10"
            >
              ✕
            </button>

            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-3">
                {selectedLineupTeam.logo_url ? (
                  <img src={selectedLineupTeam.logo_url} className="w-11 h-11 object-contain rounded-full bg-slate-950 p-1 border border-slate-800" alt="" />
                ) : (
                  <div className="w-11 h-11 bg-slate-950 rounded-full flex items-center justify-center text-lg border border-slate-800">🛡️</div>
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
                className="bg-slate-900 border border-slate-700 text-white font-bold text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
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
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/40 rounded-full pointer-events-none"></div>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-48 h-20 border-2 border-b-0 border-white/25 pointer-events-none"></div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-8 border-2 border-b-0 border-white/25 pointer-events-none"></div>
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-48 h-20 border-2 border-t-0 border-white/25 pointer-events-none"></div>

              {/* ATTAQUE */}
              <div className="relative z-10 flex justify-around items-center pt-2">
                {pitchATT.map((p, idx) => (
                  <PitchPlayerSlot 
                    key={p?.id || idx} 
                    player={p} 
                    globalIndex={1 + formationConfig.def + formationConfig.mid + idx} 
                  />
                ))}
              </div>

              {/* MILIEU */}
              <div className="relative z-10 flex justify-around items-center py-2">
                {pitchMID.map((p, idx) => (
                  <PitchPlayerSlot 
                    key={p?.id || idx} 
                    player={p} 
                    globalIndex={1 + formationConfig.def + idx} 
                  />
                ))}
              </div>

              {/* DÉFENSE */}
              <div className="relative z-10 flex justify-around items-center py-2">
                {pitchDEF.map((p, idx) => (
                  <PitchPlayerSlot 
                    key={p?.id || idx} 
                    player={p} 
                    globalIndex={1 + idx} 
                  />
                ))}
              </div>

              {/* GARDIEN */}
              <div className="relative z-10 flex justify-center items-center pb-2">
                {pitchGK.map((p) => (
                  <PitchPlayerSlot 
                    key={p?.id || 'gk'} 
                    player={p} 
                    globalIndex={0} 
                  />
                ))}
              </div>
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={handleSaveLineup}
                disabled={savingLineup}
                className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:bg-slate-800 text-white font-extrabold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>💾</span> {savingLineup ? 'Sauvegarde en cours...' : 'Sauvegarder la Composition'}
              </button>
            </div>

            {/* BANC */}
            <div className="mt-4 bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <span>🪑</span> Banc des Remplaçants ({teamBenchPlayers.length})
                </h4>
                <span className="text-[10px] text-slate-500 italic">Cliquez pour permuter avec le 11</span>
              </div>

              {teamBenchPlayers.length === 0 ? (
                <p className="text-[11px] text-slate-600">Aucun joueur sur le banc.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto pr-1">
                  {teamBenchPlayers.map((j, bIdx) => {
                    const isBenchSelected = selectedSlot?.type === 'bench' && selectedSlot?.index === bIdx;
                    return (
                      <div
                        key={j.id}
                        onClick={() => handleSelectSlot('bench', bIdx)}
                        className={`px-2 py-1.5 rounded-xl flex items-center justify-between cursor-pointer transition-all select-none border ${
                          isBenchSelected 
                            ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50' 
                            : 'bg-slate-900/90 border-slate-800 hover:border-indigo-500/60'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[10px] font-mono font-black text-amber-400">
                            #{j.numero || 10}
                          </span>
                          <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded">
                            {j.poste || 'MC'}
                          </span>
                          <span className={`text-xs font-semibold truncate ${isBenchSelected ? 'text-amber-300' : 'text-slate-300'}`}>
                            {j.nom}
                          </span>
                        </div>
                        <span className="text-[10px] font-extrabold text-emerald-400 font-mono ml-1 bg-emerald-500/10 px-1 rounded">
                          {j.general || 75}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODALE 2 : EFFECTIF COMPLET ÉQUIPE & MODIFICATION DU LOGO --- */}
      {selectedTeam && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setSelectedTeam(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-4">
                {selectedTeam.logo_url ? (
                  <img src={selectedTeam.logo_url} className="w-14 h-14 object-contain rounded-full bg-slate-950 p-1" alt="" />
                ) : (
                  <div className="w-14 h-14 bg-slate-950 rounded-full flex items-center justify-center text-xl">🛡️</div>
                )}
                <div>
                  <h3 className="text-xl font-extrabold text-white">{selectedTeam.nom}</h3>
                  <p className="text-xs text-indigo-400 font-semibold">{teamRoster.length} joueurs dans l'effectif complet</p>
                </div>
              </div>

              {userProfile?.is_admin && (
                <button
                  onClick={() => setEditingTeamLogo(selectedTeam)}
                  className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <span>📷</span> Modifier le Logo
                </button>
              )}
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Joueur</th>
                    <th className="py-2.5 px-3">Poste</th>
                    <th className="py-2.5 px-3 text-center">GEN</th>
                    <th className="py-2.5 px-3 text-center">Âge</th>
                    <th className="py-2.5 px-3 text-center">Buts</th>
                    <th className="py-2.5 px-3 text-center">Passes</th>
                    <th className="py-2.5 px-3 text-right">Valeur</th>
                    {userProfile?.is_admin && <th className="py-2.5 px-3 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm">
                  {teamRoster.length === 0 ? (
                    <tr>
                      <td colSpan={userProfile?.is_admin ? "9" : "8"} className="py-6 text-center text-slate-500 text-xs">
                        Aucun joueur enregistré dans cette équipe.
                      </td>
                    </tr>
                  ) : (
                    teamRoster.map((j) => (
                      <tr key={j.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-mono font-bold text-amber-400">#{j.numero || 10}</td>
                        <td className="py-3 px-3 font-semibold text-white">{j.nom}</td>
                        <td className="py-3 px-3 text-xs text-indigo-300 font-bold">{j.poste || 'N/A'}</td>
                        <td className="py-3 px-3 text-center font-extrabold text-emerald-400">
                          <span className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                            {j.general || 75}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center text-slate-300 font-medium">{j.age || '-'} ans</td>
                        <td className="py-3 px-3 text-center text-amber-400 font-bold">⚽ {j.buts}</td>
                        <td className="py-3 px-3 text-center text-indigo-400 font-bold">🎯 {j.passes_decisives}</td>
                        <td className="py-3 px-3 text-right font-mono text-xs text-slate-300">
                          {formatMoney(j.valeur_marchande)}
                        </td>
                        {userProfile?.is_admin && (
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setEditingPlayer(j)}
                                className="bg-amber-500/20 hover:bg-amber-600 text-amber-300 hover:text-white p-1.5 rounded-lg transition-all text-xs cursor-pointer"
                                title="Modifier ce joueur"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeletePlayer(j.id, j.nom)}
                                className="bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white p-1.5 rounded-lg transition-all text-xs cursor-pointer"
                                title="Supprimer ce joueur"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALE LOGO --- */}
      {editingTeamLogo && userProfile?.is_admin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => { setEditingTeamLogo(null); setNewLogoFile(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl cursor-pointer"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-white mb-2">📷 Modifier le Logo</h3>
            <p className="text-xs text-slate-400 mb-4">Équipe : <span className="font-bold text-indigo-400">{editingTeamLogo.nom}</span></p>

            <form onSubmit={handleUpdateTeamLogo} className="space-y-4">
              <div className="flex justify-center mb-2">
                {newLogoFile ? (
                  <img
                    src={URL.createObjectURL(newLogoFile)}
                    alt="Aperçu"
                    className="w-20 h-20 object-contain rounded-2xl bg-slate-950 p-2 border border-slate-700 shadow-lg"
                  />
                ) : editingTeamLogo.logo_url ? (
                  <img
                    src={editingTeamLogo.logo_url}
                    alt="Logo actuel"
                    className="w-20 h-20 object-contain rounded-2xl bg-slate-950 p-2 border border-slate-700 shadow-lg"
                  />
                ) : (
                  <div className="w-20 h-20 bg-slate-950 rounded-2xl flex items-center justify-center text-3xl border border-slate-700">
                    🛡️
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Choisir une nouvelle image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewLogoFile(e.target.files[0])}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white cursor-pointer"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={logoUpdating || !newLogoFile}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                {logoUpdating ? 'Mise à jour...' : 'Sauvegarder le Logo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODALE ÉDITION DE JOUEUR --- */}
      {editingPlayer && userProfile?.is_admin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setEditingPlayer(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl cursor-pointer"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-white mb-4">✏️ Modifier {editingPlayer.nom}</h3>

            <form onSubmit={handleUpdatePlayer} className="space-y-3">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-8">
                  <label className="block text-xs text-slate-400 mb-1">Nom du joueur</label>
                  <input
                    type="text"
                    value={editingPlayer.nom || ''}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, nom: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="col-span-4">
                  <label className="block text-xs text-slate-400 mb-1">N° Maillot</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={editingPlayer.numero !== undefined && editingPlayer.numero !== null ? editingPlayer.numero : 10}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, numero: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 text-center font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Poste précis</label>
                <select
                  value={
                    POSITIONS_LIST.find(
                      (p) => !p.disabled && (p.value === editingPlayer.poste || p.label === editingPlayer.poste)
                    )?.value || 'MC'
                  }
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, poste: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {POSITIONS_LIST.map((pos, idx) => (
                    pos.disabled ? (
                      <option key={idx} disabled className="font-bold text-indigo-400 bg-slate-900">
                        {pos.label}
                      </option>
                    ) : (
                      <option key={pos.value} value={pos.value}>
                        {pos.label}
                      </option>
                    )
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Général</label>
                  <input
                    type="number"
                    min="40"
                    max="99"
                    value={editingPlayer.general !== undefined && editingPlayer.general !== null ? editingPlayer.general : 75}
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
                    value={editingPlayer.age !== undefined && editingPlayer.age !== null ? editingPlayer.age : 22}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, age: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Valeur (€)</label>
                  <input
                    type="number"
                    step="500000"
                    value={editingPlayer.valeur_marchande !== undefined && editingPlayer.valeur_marchande !== null ? editingPlayer.valeur_marchande : 10000000}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, valeur_marchande: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm mt-2 transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                Enregistrer les modifications
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODALE FEUILLE DE MATCH SCINDÉE EN 2 COLONNES (DOMICILE & EXTÉRIEUR) --- */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedMatch(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl cursor-pointer"
            >
              ✕
            </button>

            <h3 className="text-lg font-extrabold text-white text-center mb-1">Détails de la Rencontre</h3>
            <p className="text-xs text-slate-400 text-center mb-4">{getSeasonLabel(selectedMatch.saison || 1)} - Journée {selectedMatch.journee}</p>

            {/* Scoreboard Principal */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between mb-6 shadow-inner">
              <div className="flex items-center gap-3 w-5/12 truncate">
                {selectedMatch.dom?.logo_url ? (
                  <img src={selectedMatch.dom.logo_url} className="w-9 h-9 object-contain shrink-0" alt="" />
                ) : (
                  <span className="text-xl shrink-0">🛡️</span>
                )}
                <span className="font-bold text-white text-sm truncate">{selectedMatch.dom?.nom}</span>
              </div>

              <div className="text-center font-mono font-black text-2xl text-emerald-400 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shrink-0">
                {selectedMatch.score_domicile ?? 0} - {selectedMatch.score_exterieur ?? 0}
              </div>

              <div className="flex items-center gap-3 w-5/12 justify-end truncate">
                <span className="font-bold text-white text-sm truncate text-right">{selectedMatch.ext?.nom}</span>
                {selectedMatch.ext?.logo_url ? (
                  <img src={selectedMatch.ext.logo_url} className="w-9 h-9 object-contain shrink-0" alt="" />
                ) : (
                  <span className="text-xl shrink-0">🛡️</span>
                )}
              </div>
            </div>

            {/* CONTENU SCINDÉ EN 2 COLONNES : DOMICILE (GAUCHE) / EXTÉRIEUR (DROITE) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* COLONNE 1 : ÉVÉNEMENTS ÉQUIPE DOMICILE */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
                  <span className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider truncate">
                    {selectedMatch.dom?.nom}
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {homeEvents.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-4 text-center italic">Aucun événement</p>
                  ) : (
                    homeEvents.map(ev => {
                      let icon = '⚽';
                      let typeLabel = 'But';
                      let colorClass = 'text-amber-400';
                      if (ev.type === 'passe') {
                        icon = '🎯';
                        typeLabel = 'Passe D.';
                        colorClass = 'text-indigo-300';
                      } else if (ev.type === 'carton_jaune') {
                        icon = '🟨';
                        typeLabel = 'Jaune';
                        colorClass = 'text-yellow-400';
                      } else if (ev.type === 'carton_rouge') {
                        icon = '🟥';
                        typeLabel = 'Rouge';
                        colorClass = 'text-rose-400';
                      }

                      return (
                        <div key={ev.id} className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-slate-400 text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                              {ev.minute ? `${ev.minute}'` : "45'"}
                            </span>
                            <span className="text-sm">{icon}</span>
                            <span className="font-semibold text-white truncate text-xs">
                              {ev.players?.nom}
                            </span>
                          </div>
                          <span className={`text-[10px] font-bold ${colorClass}`}>
                            {typeLabel}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* COLONNE 2 : ÉVÉNEMENTS ÉQUIPE EXTÉRIEURE */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800 justify-end">
                  <span className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider truncate text-right">
                    {selectedMatch.ext?.nom}
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {awayEvents.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-4 text-center italic">Aucun événement</p>
                  ) : (
                    awayEvents.map(ev => {
                      let icon = '⚽';
                      let typeLabel = 'But';
                      let colorClass = 'text-amber-400';
                      if (ev.type === 'passe') {
                        icon = '🎯';
                        typeLabel = 'Passe D.';
                        colorClass = 'text-indigo-300';
                      } else if (ev.type === 'carton_jaune') {
                        icon = '🟨';
                        typeLabel = 'Jaune';
                        colorClass = 'text-yellow-400';
                      } else if (ev.type === 'carton_rouge') {
                        icon = '🟥';
                        typeLabel = 'Rouge';
                        colorClass = 'text-rose-400';
                      }

                      return (
                        <div key={ev.id} className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-slate-400 text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                              {ev.minute ? `${ev.minute}'` : "45'"}
                            </span>
                            <span className="text-sm">{icon}</span>
                            <span className="font-semibold text-white truncate text-xs">
                              {ev.players?.nom}
                            </span>
                          </div>
                          <span className={`text-[10px] font-bold ${colorClass}`}>
                            {typeLabel}
                          </span>
                        </div>
                      );
                    })
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
