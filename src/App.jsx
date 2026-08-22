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
  const [savingProgress, setSavingProgress] = useState(false);

  // Suivi du cumul d'évolution par saison
  const [seasonEvolutions, setSeasonEvolutions] = useState({});

  // Modales
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedMatchEvents, setSelectedMatchEvents] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);

  // POP-UPS SPÉCIAUX (Évolutions & Mercato)
  const [evolutionReport, setEvolutionReport] = useState(null);
  const [mercatoReport, setMercatoReport] = useState(null);

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

  // Transferts Manuels
  const [transferFromTeamId, setTransferFromTeamId] = useState('');
  const [transferPlayerId, setTransferPlayerId] = useState('');
  const [transferToTeamId, setTransferToTeamId] = useState('');
  const [transferFee, setTransferFee] = useState(10000000);
  const [transferLoading, setTransferLoading] = useState(false);

  // Séquence d'initialisation propre
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        await fetchUserProfile(session.user.id);
        await fetchData(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await fetchUserProfile(session.user.id);
        await fetchData(session.user.id);
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function showNotif(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4500);
  }

  async function fetchUserProfile(userId) {
    if (!userId) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setUserProfile(data);
      if (data.current_season) setSeasonFilter(data.current_season);
      if (data.current_journee) setJourneeFilter(data.current_journee);
    } else {
      const savedSeason = localStorage.getItem(`season_${userId}`);
      const savedJournee = localStorage.getItem(`journee_${userId}`);
      if (savedSeason) setSeasonFilter(parseInt(savedSeason, 10));
      if (savedJournee) setJourneeFilter(parseInt(savedJournee, 10));
    }
  }

  async function handleSaveTournamentProgress() {
    const currentUid = session?.user?.id;
    if (!currentUid) return;
    setSavingProgress(true);

    try {
      localStorage.setItem(`season_${currentUid}`, seasonFilter);
      localStorage.setItem(`journee_${currentUid}`, journeeFilter);

      await supabase
        .from('profiles')
        .update({
          current_season: parseInt(seasonFilter, 10),
          current_journee: parseInt(journeeFilter, 10)
        })
        .eq('id', currentUid);

      showNotif(`Progression sauvegardée ! Reprise à la Journée ${journeeFilter} (${getSeasonLabel(seasonFilter)})`);
    } catch (err) {
      showNotif(`Progression sauvegardée localement (Saison ${seasonFilter}, Journée ${journeeFilter}).`);
    }

    setSavingProgress(false);
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
    const currentUid = session?.user?.id;
    if (currentUid) {
      localStorage.setItem(`season_${currentUid}`, seasonFilter);
      localStorage.setItem(`journee_${currentUid}`, journeeFilter);
    }
    await supabase.auth.signOut();
    showNotif("Déconnexion réussie. Votre progression a été sauvegardée.");
  }

  async function fetchData(uidOverride) {
    const activeUserId = uidOverride || session?.user?.id;
    if (!activeUserId) return;

    // 1. Charger les équipes
    const { data: dataTeams, error: errTeams } = await supabase.from('teams').select('*');
    if (errTeams) console.error('Erreur Teams:', errTeams.message);
    const currentTeams = dataTeams || [];
    setTeams(currentTeams);

    // 2. Charger les joueurs avec leurs notes actuelles
    const { data: dataPlayers, error: errPlayers } = await supabase
      .from('players')
      .select('*, teams!players_equipe_id_fkey(nom, logo_url)');
    if (errPlayers) {
      console.error('Erreur Players:', errPlayers.message);
    } else if (dataPlayers) {
      setPlayers(dataPlayers);
    }

    // 3. Charger les matchs directement sans jointures lourdes (Anti-timeout)
    const { data: rawMatches, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('user_id', activeUserId)
      .order('journee', { ascending: true })
      .order('id', { ascending: true });

    if (matchError) {
      alert(`⚠️ ERREUR MATCHS :\n${matchError.message}`);
      return;
    }

    if (rawMatches) {
      const enrichedMatches = rawMatches.map(m => ({
        ...m,
        dom: currentTeams.find(t => t.id === m.equipe_domicile_id) || null,
        ext: currentTeams.find(t => t.id === m.equipe_exterieur_id) || null
      }));

      setMatches(enrichedMatches);

      const maxS = Math.max(...enrichedMatches.map(m => m.saison || 1), 1);
      const savedSeason = localStorage.getItem(`season_${activeUserId}`);
      const savedJournee = localStorage.getItem(`journee_${activeUserId}`);

      const activeSeason = savedSeason ? parseInt(savedSeason, 10) : maxS;
      setSeasonFilter(activeSeason);

      if (savedJournee) {
        setJourneeFilter(parseInt(savedJournee, 10));
      } else {
        const firstUnfinished = enrichedMatches.find(
          m => m.statut !== 'terminé' && (m.saison || 1) === activeSeason
        );
        if (firstUnfinished) {
          setJourneeFilter(firstUnfinished.journee || 1);
        }
      }
    }

    // 4. Charger les événements
    const { data: dataEvents, error: errEvents } = await supabase
      .from('match_events')
      .select('*')
      .eq('user_id', activeUserId);
    if (errEvents) console.error('Erreur Events:', errEvents.message);
    if (dataEvents) setMatchEvents(dataEvents);

    // 5. Charger les transferts
    const { data: dataTransfers, error: errTransfers } = await supabase
      .from('transfers')
      .select('*, players(nom), old_team:teams!old_team_id(nom), new_team:teams!new_team_id(nom)')
      .order('created_at', { ascending: false })
      .limit(15);
    if (errTransfers) console.error('Erreur Transferts:', errTransfers.message);
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

  function getTeamStartersAndBench(team) {
    if (!team) return { starters: [], bench: [] };
    const all = getSortedTeamPlayers(team.id);
    let savedIds = team.lineup_ids;
    if (typeof savedIds === 'string') {
      try { savedIds = JSON.parse(savedIds); } catch (e) { savedIds = []; }
    }
    if (Array.isArray(savedIds) && savedIds.length >= 11) {
      const map = new Map(all.map(p => [p.id, p]));
      const starters = savedIds.map(id => map.get(id)).filter(Boolean);
      const starterSet = new Set(starters.map(p => p.id));
      const bench = all.filter(p => !starterSet.has(p.id));
      if (starters.length >= 11) {
        return { starters: starters.slice(0, 11), bench };
      }
    }
    return { starters: all.slice(0, 11), bench: all.slice(11) };
  }

  // --- MOTEUR DE TRANSFERTS MERCATO D'HIVER ---
  async function triggerWinterMercato(journeeNum, currentSeasonNum) {
    if (!teams || teams.length < 2 || !players || players.length < 10) return;

    const teamCounts = {};
    teams.forEach(t => {
      teamCounts[t.id] = players.filter(p => p.equipe_id === t.id).length;
    });

    const rankedTeams = [...classement];
    const topClubs = rankedTeams.slice(0, Math.max(1, Math.floor(rankedTeams.length * 0.4)));
    const midClubs = rankedTeams.slice(Math.floor(rankedTeams.length * 0.4), Math.floor(rankedTeams.length * 0.7));
    const bottomClubs = rankedTeams.slice(Math.max(1, Math.floor(rankedTeams.length * 0.7)));

    const availablePool = [...players].sort(() => Math.random() - 0.5);
    const completedTransfers = [];
    const transferInserts = [];
    const usedPlayerIds = new Set();

    for (const player of availablePool) {
      if (completedTransfers.length >= 3) break;
      if (usedPlayerIds.has(player.id)) continue;

      const currentGen = player.general || 75;
      const age = player.age || 24;
      const originTeamId = player.equipe_id;
      const originTeam = teams.find(t => t.id === originTeamId);
      if (!originTeam) continue;

      if ((teamCounts[originTeamId] || 0) <= 16) continue;

      let destinationTeam = null;
      let reason = '';

      const canBuy = (club) => club.id !== originTeamId && (teamCounts[club.id] || 0) < 28;

      if ((age <= 23 && currentGen >= 77) || currentGen >= 83) {
        const candidateDest = topClubs.filter(canBuy);
        if (candidateDest.length > 0) {
          destinationTeam = candidateDest[Math.floor(Math.random() * candidateDest.length)];
          reason = age <= 23 ? "Jeune pépite recrutée par un cador" : "Transfert star de haut niveau";
        }
      } else if (age >= 29 || currentGen <= 74) {
        const candidateDest = bottomClubs.filter(canBuy);
        if (candidateDest.length > 0) {
          destinationTeam = candidateDest[Math.floor(Math.random() * candidateDest.length)];
          reason = "En quête de temps de jeu et de relance";
        }
      } else {
        const candidateDest = [...midClubs, ...topClubs, ...bottomClubs].filter(canBuy);
        if (candidateDest.length > 0) {
          destinationTeam = candidateDest[Math.floor(Math.random() * candidateDest.length)];
          reason = "Renfort stratégique hivernal";
        }
      }

      if (destinationTeam) {
        usedPlayerIds.add(player.id);
        const fee = player.valeur_marchande || calculateMarketValue(currentGen, age);

        teamCounts[originTeamId]--;
        teamCounts[destinationTeam.id]++;

        await supabase
          .from('players')
          .update({ equipe_id: destinationTeam.id })
          .eq('id', player.id);

        transferInserts.push({
          player_id: player.id,
          old_team_id: originTeam.id,
          new_team_id: destinationTeam.id,
          fee: fee,
          user_id: session.user.id
        });

        completedTransfers.push({
          id: player.id,
          nom: player.nom,
          poste: player.poste,
          general: currentGen,
          age: age,
          oldTeam: originTeam.nom,
          newTeam: destinationTeam.nom,
          fee: fee,
          reason: reason
        });
      }
    }

    if (transferInserts.length > 0) {
      await supabase.from('transfers').insert(transferInserts);
    }

    if (completedTransfers.length > 0) {
      setMercatoReport({
        journee: journeeNum,
        seasonLabel: getSeasonLabel(currentSeasonNum),
        transfers: completedTransfers
      });
    }
  }

  // --- MOTEUR D'ÉVOLUTION DYNAMIQUE ---
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
        else teamRecords[m.equipe_domicile_id].draws++;
      }
    });

    const currentSeasonMap = { ...(seasonEvolutions[currentSeasonNum] || {}) };
    const candidates = [];

    for (const player of players) {
      const currentGen = player.general || 75;
      const currentVal = player.valeur_marchande || 10000000;
      const age = player.age || 24;
      const pos = player.poste || 'MC';

      const pEvents = blockEvents.filter(e => e.player_id === player.id);
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
        if (perfScore >= 9.5) delta = +1;
        else if (perfScore <= -2.5) delta = -2;
        else if (perfScore <= 0.5) delta = -1;
      } else if (currentGen >= 82) {
        if (perfScore >= 11.0) delta = +2;
        else if (perfScore >= 6.5) delta = +1;
        else if (perfScore <= -3.5) delta = -2;
        else if (perfScore <= 0.0) delta = -1;
      } else if (currentGen >= 74) {
        if (perfScore >= 9.5) delta = +2;
        else if (perfScore >= 4.5) delta = +1;
        else if (perfScore <= -3.0) delta = -2;
        else if (perfScore <= -0.5) delta = -1;
      } else {
        if (perfScore >= 9.0) delta = +3;
        else if (perfScore >= 5.5) delta = +2;
        else if (perfScore >= 2.5) delta = +1;
        else if (perfScore <= -4.0) delta = -2;
        else if (perfScore <= -1.5) delta = -1;
      }

      delta = Math.max(-3, Math.min(3, delta));

      const currentCumulative = currentSeasonMap[player.id] || 0;
      let allowedDelta = delta;

      if (delta > 0) {
        allowedDelta = Math.min(delta, 3 - currentCumulative);
      } else if (delta < 0) {
        allowedDelta = Math.max(delta, -3 - currentCumulative);
      }

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
    const playerUpdates = [];
    const countByTeam = {};

    candidates.sort((a, b) => b.absImpact - a.absImpact);

    for (const c of candidates) {
      const tId = c.player.equipe_id;
      countByTeam[tId] = countByTeam[tId] || 0;

      if (countByTeam[tId] < 3) {
        countByTeam[tId]++;

        const newGen = Math.max(45, Math.min(99, c.currentGen + c.delta));
        const newVal = calculateMarketValue(newGen, c.age);

        currentSeasonMap[c.player.id] = c.currentCumulative + c.delta;

        playerUpdates.push({ id: c.player.id, general: newGen, valeur_marchande: newVal });
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

    setSeasonEvolutions(prev => ({ ...prev, [currentSeasonNum]: currentSeasonMap }));

    if (playerUpdates.length > 0) {
      for (const upd of playerUpdates) {
        await supabase
          .from('players')
          .update({ general: upd.general, valeur_marchande: upd.valeur_marchande })
          .eq('id', upd.id);
      }
    }

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
    const weighted = activePlayers.map(p => {
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
    return activePlayers[0];
  }

  function pickAssister(activePlayers, scorer) {
    if (!activePlayers || activePlayers.length < 2) return null;
    const candidates = activePlayers.filter(p => p.id !== scorer?.id);
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

  function handleRollDice(matchId) {
    const diceDom = Math.floor(Math.random() * 6) + 1;
    const diceExt = Math.floor(Math.random() * 6) + 1;

    setScoresInput(prev => ({
      ...prev,
      [matchId]: {
        dom: diceDom,
        ext: diceExt
      }
    }));
    showNotif(`🎲 Lancer de dé : ${diceDom} - ${diceExt}`);
  }

  function generateMatchEventsForCustomScore(m, domTeam, extTeam, scoreDom, scoreExt, seasonNum, userId) {
    const { starters: domStarters, bench: domBench } = getTeamStartersAndBench(domTeam);
    const { starters: extStarters, bench: extBench } = getTeamStartersAndBench(extTeam);

    const matchEventsList = [];

    // Remplacements Domicile
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
        minute: subMinute,
        saison: seasonNum,
        user_id: userId
      });
    }

    // Remplacements Extérieur
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
        minute: subMinute,
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

    // Buts Domicile
    for (let i = 0; i < scoreDom; i++) {
      const minute = Math.floor(Math.random() * 90) + 1;
      const activeAtMin = getActivePlayersAtMinute(domStarters, domSubstitutions, minute);
      const scorer = pickGoalScorer(activeAtMin);
      if (scorer) {
        matchEventsList.push({
          match_id: m.id,
          player_id: scorer.id,
          type: 'but',
          minute: minute,
          saison: seasonNum,
          user_id: userId
        });
        if (Math.random() < 0.75) {
          const assister = pickAssister(activeAtMin, scorer);
          if (assister) {
            matchEventsList.push({
              match_id: m.id,
              player_id: assister.id,
              type: 'passe',
              minute: minute,
              saison: seasonNum,
              user_id: userId
            });
          }
        }
      }
    }

    // Buts Extérieur
    for (let i = 0; i < scoreExt; i++) {
      const minute = Math.floor(Math.random() * 90) + 1;
      const activeAtMin = getActivePlayersAtMinute(extStarters, extSubstitutions, minute);
      const scorer = pickGoalScorer(activeAtMin);
      if (scorer) {
        matchEventsList.push({
          match_id: m.id,
          player_id: scorer.id,
          type: 'but',
          minute: minute,
          saison: seasonNum,
          user_id: userId
        });
        if (Math.random() < 0.75) {
          const assister = pickAssister(extStarters, scorer);
          if (assister) {
            matchEventsList.push({
              match_id: m.id,
              player_id: assister.id,
              type: 'passe',
              minute: minute,
              saison: seasonNum,
              user_id: userId
            });
          }
        }
      }
    }

    // Cartons Domicile
    const numYellowDom = Math.random() < 0.65 ? Math.floor(Math.random() * 3) + 1 : 0;
    for (let y = 0; y < numYellowDom; y++) {
      const minute = Math.floor(Math.random() * 88) + 2;
      const activeAtMin = getActivePlayersAtMinute(domStarters, domSubstitutions, minute);
      const carded = pickCardPlayer(activeAtMin);
      if (carded) {
        matchEventsList.push({
          match_id: m.id,
          player_id: carded.id,
          type: 'carton_jaune',
          minute: minute,
          saison: seasonNum,
          user_id: userId
        });
      }
    }

    // Cartons Extérieur
    const numYellowExt = Math.random() < 0.65 ? Math.floor(Math.random() * 3) + 1 : 0;
    for (let y = 0; y < numYellowExt; y++) {
      const minute = Math.floor(Math.random() * 88) + 2;
      const activeAtMin = getActivePlayersAtMinute(extStarters, extSubstitutions, minute);
      const carded = pickCardPlayer(activeAtMin);
      if (carded) {
        matchEventsList.push({
          match_id: m.id,
          player_id: carded.id,
          type: 'carton_jaune',
          minute: minute,
          saison: seasonNum,
          user_id: userId
        });
      }
    }

    return matchEventsList;
  }

  function simulateSingleMatchWithSubs(m, domTeam, extTeam, seasonNum, userId) {
    const { starters: domStarters } = getTeamStartersAndBench(domTeam);
    const { starters: extStarters } = getTeamStartersAndBench(extTeam);

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

  // --- SIMULATION AUTOMATIQUE D'UNE JOURNÉE COMPLÈTE ---
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
      const matchUpdates = [];
      const newEvents = [];
      const matchIdsToClear = currentJourneeMatches.map(m => m.id);

      for (const mId of matchIdsToClear) {
        await supabase.from('match_events').delete().eq('match_id', mId);
      }

      for (const m of currentJourneeMatches) {
        const domTeam = teams.find(t => t.id === m.equipe_domicile_id);
        const extTeam = teams.find(t => t.id === m.equipe_exterieur_id);

        const simResult = simulateSingleMatchWithSubs(m, domTeam, extTeam, m.saison || 1, session.user.id);

        matchUpdates.push({
          id: m.id,
          score_domicile: simResult.scoreDom,
          score_exterieur: simResult.scoreExt,
          statut: 'terminé'
        });

        newEvents.push(...simResult.events);
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

      const currentJ = parseInt(journeeFilter, 10);
      const currentS = parseInt(seasonFilter, 10);

      // Persistance automatique immédiate
      localStorage.setItem(`season_${session.user.id}`, currentS);
      localStorage.setItem(`journee_${session.user.id}`, currentJ);

      await supabase
        .from('profiles')
        .update({
          current_season: currentS,
          current_journee: currentJ
        })
        .eq('id', session.user.id);

      showNotif(`Journée ${journeeFilter} simulée avec succès !`);
      await fetchData();

      // 1. MERCATO D'HIVER (JOURNÉES 19 À 23)
      if (currentJ >= 19 && currentJ <= 23) {
        await triggerWinterMercato(currentJ, currentS);
        await fetchData();
      }

      // 2. ÉVOLUTION DES JOUEURS (TOUTES LES 4 JOURNÉES)
      if (currentJ % 4 === 0) {
        await evaluateAndApplyPlayerEvolutions(currentJ, currentS);
        await fetchData();
      }
    } catch (err) {
      alert(`Erreur de simulation : ${err.message}`);
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

  // --- GESTION DES SAISONS (REINITIALISATION vs SAISON SUIVANTE) ---
  async function handleStartNewSeason(isNextSeason = false) {
    if (!teams || teams.length < 2) {
      alert(`Erreur : Il vous faut au moins 2 équipes pour générer un calendrier (actuellement : ${teams ? teams.length : 0}). Créez-les dans l'onglet Admin.`);
      return;
    }

    const currentMaxSeason = matches.length > 0 ? Math.max(...matches.map(m => m.saison || 1), 1) : 1;
    const targetSeason = isNextSeason ? currentMaxSeason + 1 : 1;
    const seasonLabel = getSeasonLabel(targetSeason);

    const totalJournees = (teams.length % 2 === 0 ? teams.length - 1 : teams.length) * 2;

    const confirmMsg = isNextSeason
      ? `Voulez-vous lancer la ${seasonLabel} ?\n\n- Vous conservez vos transferts et évolutions actuels.\n- ${totalJournees} Journées programmées.`
      : `Voulez-vous REINITIALISER complètement le tournoi (Saison 1) ?\n\n- Tous les joueurs retourneront dans leur club d'origine avec leurs notes de base.\n- L'historique des transferts et matchs sera effacé.`;

    if (!window.confirm(confirmMsg)) return;

    setGeneratingSchedule(true);

    try {
      if (!isNextSeason) {
        // 🔄 CAS REINITIALISATION COMPLETE : Remettre les joueurs dans leurs clubs d'origine
        const { data: allUserTransfers } = await supabase
          .from('transfers')
          .select('*')
          .order('created_at', { ascending: true });

        if (allUserTransfers && allUserTransfers.length > 0) {
          const initialClubByPlayer = {};
          allUserTransfers.forEach(t => {
            if (!initialClubByPlayer[t.player_id]) {
              initialClubByPlayer[t.player_id] = t.old_team_id;
            }
          });

          for (const [playerId, originalTeamId] of Object.entries(initialClubByPlayer)) {
            await supabase
              .from('players')
              .update({ equipe_id: originalTeamId })
              .eq('id', playerId);
          }

          await supabase.from('transfers').delete().eq('user_id', session.user.id);
        }

        // Vider tous les anciens matchs et événements
        await supabase.from('match_events').delete().eq('user_id', session.user.id);
        await supabase.from('matches').delete().eq('user_id', session.user.id);
        setTransfers([]);
      } else {
        // 🚀 CAS SAISON SUIVANTE : On garde les transferts/joueurs actuels, on vide juste les anciens matchs pour garder la DB ultra rapide
        await supabase.from('match_events').delete().eq('user_id', session.user.id);
        await supabase.from('matches').delete().eq('user_id', session.user.id);
      }

      // Générer le nouveau calendrier
      const fixtures = buildRoundRobinFixtures(teams, session.user.id, targetSeason);
      
      if (!fixtures || fixtures.length === 0) {
        alert("Erreur critique : le générateur n'a produit aucun match.");
        setGeneratingSchedule(false);
        return;
      }

      // Insertion par paquets légers de 100 pour éviter tout timeout
      const chunkSize = 100;
      let insertedCount = 0;

      for (let i = 0; i < fixtures.length; i += chunkSize) {
        const chunk = fixtures.slice(i, i + chunkSize);
        const { error } = await supabase.from('matches').insert(chunk);
        
        if (error) {
          throw new Error(`Erreur lors de l'insertion du bloc : ${error.message}`);
        }
        insertedCount += chunk.length;
      }

      showNotif(isNextSeason ? `${seasonLabel} lancée ! Effectifs conservés.` : `Tournoi réinitialisé avec clubs et effectifs de base !`);
      
      setSeasonFilter(targetSeason);
      setJourneeFilter(1);
      setSeasonEvolutions({});

      if (session?.user?.id) {
        localStorage.setItem(`season_${session.user.id}`, targetSeason);
        localStorage.setItem(`journee_${session.user.id}`, 1);

        await supabase
          .from('profiles')
          .update({
            current_season: targetSeason,
            current_journee: 1
          })
          .eq('id', session.user.id);
      }

      await fetchData();
      
    } catch (err) {
      alert(`Erreur Supabase : ${err.message}`);
    }

    setGeneratingSchedule(false);
  }

  const seasonMatches = matches.filter(m => (m.saison || 1) === parseInt(seasonFilter, 10));
  const seasonEvents = matchEvents.filter(e => (e.saison || 1) === parseInt(seasonFilter, 10));

  const availableSeasons = Array.from(
    new Set([...matches.map(m => m.saison || 1), 1, parseInt(seasonFilter, 10)])
  ).sort((a, b) => a - b);

  // --- CALCUL DU CLASSEMENT COMPLET ---
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

          if (scorePour > scoreContre) {
            points += 3;
            victoires++;
          } else if (scorePour === scoreContre) {
            points += 1;
            nuls++;
          } else {
            defaites++;
          }
        } else if (m.equipe_exterieur_id === team.id) {
          joues++;
          const scorePour = m.score_exterieur ?? 0;
          const scoreContre = m.score_domicile ?? 0;
          butsPour += scorePour;
          butsContre += scoreContre;

          if (scorePour > scoreContre) {
            points += 3;
            victoires++;
          } else if (scorePour === scoreContre) {
            points += 1;
            nuls++;
          } else {
            defaites++;
          }
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

  const availableSellerTeams = teams.filter(t => {
    const count = players.filter(p => p.equipe_id === t.id).length;
    return count > 16;
  });

  const availablePlayersForTransfer = players.filter(p => p.equipe_id === transferFromTeamId);

  const availableDestinationTeams = teams.filter(t => {
    if (t.id === transferFromTeamId) return false;
    const count = players.filter(p => p.equipe_id === t.id).length;
    return count < 28;
  });

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

    const sellerCount = players.filter(p => p.equipe_id === transferFromTeamId).length;
    if (sellerCount <= 16) {
      showNotif("Ce club a 16 joueurs ou moins : il ne peut plus vendre de joueur !");
      return;
    }

    const buyerCount = players.filter(p => p.equipe_id === transferToTeamId).length;
    if (buyerCount >= 28) {
      showNotif("Ce club a atteint le quota max de 28 joueurs : recrutement impossible !");
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

  async function handleCancelTransfer(transfer) {
    if (!window.confirm(`Voulez-vous annuler le transfert de "${transfer.players?.nom || 'ce joueur'}" et le renvoyer à ${transfer.old_team?.nom || 'son ancien club'} ?`)) {
      return;
    }

    const originClubCount = players.filter(p => p.equipe_id === transfer.old_team_id).length;
    if (originClubCount >= 28) {
      showNotif(`Impossible : ${transfer.old_team?.nom || "L'ancien club"} a déjà 28 joueurs !`);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('players')
        .update({ equipe_id: transfer.old_team_id })
        .eq('id', transfer.player_id);

      if (updateError) throw updateError;

      const { error: deleteError } = await supabase
        .from('transfers')
        .delete()
        .eq('id', transfer.id);

      if (deleteError) throw deleteError;

      showNotif(`Transfert annulé : ${transfer.players?.nom || 'Joueur'} est retourné à ${transfer.old_team?.nom || 'son club'}.`);
      await fetchData();
    } catch (err) {
      showNotif(`Erreur : ${err.message}`);
    }
  }

  async function handleResetAllTransfers() {
    if (transfers.length === 0) {
      showNotif("Aucun transfert à réinitialiser.");
      return;
    }

    if (!window.confirm("Êtes-vous sûr de vouloir annuler TOUS les transferts ? Tous les joueurs retourneront dans leur club initial et l'historique sera effacé.")) {
      return;
    }

    try {
      const { data: allUserTransfers, error: fetchErr } = await supabase
        .from('transfers')
        .select('*')
        .order('created_at', { ascending: true });

      if (fetchErr) throw fetchErr;

      if (allUserTransfers && allUserTransfers.length > 0) {
        const initialClubByPlayer = {};
        allUserTransfers.forEach(t => {
          if (!initialClubByPlayer[t.player_id]) {
            initialClubByPlayer[t.player_id] = t.old_team_id;
          }
        });

        for (const [playerId, originalTeamId] of Object.entries(initialClubByPlayer)) {
          await supabase
            .from('players')
            .update({ equipe_id: originalTeamId })
            .eq('id', playerId);
        }

        const transferIds = allUserTransfers.map(t => t.id);
        const { error: deleteError } = await supabase
          .from('transfers')
          .delete()
          .in('id', transferIds);

        if (deleteError) throw deleteError;
      }

      setTransfers([]);
      showNotif("Tous les transferts ont été réinitialisés et l'historique a été effacé !");
      
      const { data: dataTeams } = await supabase.from('teams').select('*');
      if (dataTeams) setTeams(dataTeams);

      const { data: dataPlayers } = await supabase.from('players').select('*, teams!players_equipe_id_fkey(nom, logo_url)');
      if (dataPlayers) setPlayers(dataPlayers);
    } catch (err) {
      showNotif(`Erreur : ${err.message}`);
    }
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
      const newGen = editingPlayer.general ? parseInt(editingPlayer.general, 10) : 75;
      const newAge = editingPlayer.age ? parseInt(editingPlayer.age, 10) : 22;
      const calculatedVal = editingPlayer.valeur_marchande !== undefined 
        ? parseInt(editingPlayer.valeur_marchande, 10) 
        : calculateMarketValue(newGen, newAge);

      const { error } = await supabase
        .from('players')
        .update({
          nom: editingPlayer.nom,
          poste: editingPlayer.poste,
          numero: editingPlayer.numero ? parseInt(editingPlayer.numero, 10) : 10,
          general: newGen,
          age: newAge,
          valeur_marchande: calculatedVal
        })
        .eq('id', editingPlayer.id);

      if (error) showNotif(`Erreur : ${error.message}`);
      else {
        showNotif(`Joueur "${editingPlayer.nom}" mis à jour avec une valeur de ${formatMoney(calculatedVal)} !`);
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

  // --- OUVERTURE DE LA MODALE VS ---
  async function openMatchDetails(match) {
    setSelectedMatch(match);
    const { data, error } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', match.id)
      .order('minute', { ascending: true });

    if (error) {
      showNotif(`Erreur détails match : ${error.message}`);
      return;
    }

    if (data) {
      const enriched = data.map(ev => {
        const pObj = players.find(p => p.id === ev.player_id);
        return {
          ...ev,
          player_nom: pObj?.nom || 'Joueur inconnu',
          player_equipe_id: pObj?.equipe_id || null
        };
      });
      setSelectedMatchEvents(enriched);
    }
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

    const domTeam = teams.find(t => t.id === match.equipe_domicile_id);
    const extTeam = teams.find(t => t.id === match.equipe_exterieur_id);

    try {
      await supabase.from('match_events').delete().eq('match_id', match.id);

      const events = generateMatchEventsForCustomScore(
        match, 
        domTeam, 
        extTeam, 
        scoreDom, 
        scoreExt, 
        match.saison || 1, 
        session.user.id
      );

      if (events.length > 0) {
        const { error: insertEventsError } = await supabase.from('match_events').insert(events);
        if (insertEventsError) throw insertEventsError;
      }

      const { error: matchError } = await supabase
        .from('matches')
        .update({ score_domicile: scoreDom, score_exterieur: scoreExt, statut: 'terminé' })
        .eq('id', match.id)
        .eq('user_id', session.user.id);

      if (matchError) throw matchError;

      const currentJ = match.journee;
      const currentS = match.saison || 1;

      // Persistance automatique immédiate
      localStorage.setItem(`season_${session.user.id}`, currentS);
      localStorage.setItem(`journee_${session.user.id}`, currentJ);

      await supabase
        .from('profiles')
        .update({
          current_season: currentS,
          current_journee: currentJ
        })
        .eq('id', session.user.id);

      showNotif(`Score ${scoreDom} - ${scoreExt} et événements enregistrés !`);
      await fetchData();

      const otherMatchesInJ = seasonMatches.filter(m => m.journee === currentJ && m.id !== match.id);
      const allCompleted = otherMatchesInJ.every(m => m.statut === 'terminé');

      if (allCompleted) {
        if (currentJ >= 19 && currentJ <= 23) {
          await triggerWinterMercato(currentJ, currentS);
          await fetchData();
        }
        if (currentJ % 4 === 0) {
          await evaluateAndApplyPlayerEvolutions(currentJ, currentS);
          await fetchData();
        }
      }
    } catch (err) {
      showNotif(`Erreur : ${err.message}`);
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

    const teamCount = players.filter(p => p.equipe_id === newPlayer.equipe_id).length;
    if (teamCount >= 28) {
      showNotif("Cette équipe a déjà atteint la limite maximale de 28 joueurs !");
      return;
    }

    const gen = parseInt(newPlayer.general, 10) || 75;
    const age = parseInt(newPlayer.age, 10) || 22;
    const val = parseInt(newPlayer.valeur, 10) || calculateMarketValue(gen, age);

    const { error } = await supabase.from('players').insert([{
      nom: newPlayer.nom,
      equipe_id: newPlayer.equipe_id,
      numero: parseInt(newPlayer.numero, 10) || 10,
      poste: newPlayer.poste,
      general: gen,
      valeur_marchande: val,
      age: age
    }]);

    if (error) showNotif(`Erreur : ${error.message}`);
    else {
      showNotif(`Joueur "${newPlayer.nom}" (#${newPlayer.numero || 10}) ajouté (${formatMoney(val)}) !`);
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
      if (session?.user?.id) {
        localStorage.setItem(`journee_${session.user.id}`, nextJ);
      }
    } else {
      showNotif("Vous êtes sur la dernière journée de cette saison !");
    }
  }

  function handlePrevJournee() {
    if (journeeFilter > 1) {
      const prevJ = journeeFilter - 1;
      setJourneeFilter(prevJ);
      if (session?.user?.id) {
        localStorage.setItem(`journee_${session.user.id}`, prevJ);
      }
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
    ? selectedMatchEvents.filter(ev => ev.player_equipe_id === selectedMatch.equipe_domicile_id) 
    : [];

  const awayEvents = selectedMatch 
    ? selectedMatchEvents.filter(ev => ev.player_equipe_id === selectedMatch.equipe_exterieur_id) 
    : [];

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
        {/* 1. CLASSEMENT COMPLET DES ÉQUIPES */}
        {tab === 'classement' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">🏆 Classement Général</h2>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Top 4 : Qualification européenne</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> 3 Derniers : Zone rouge</span>
                </div>
              </div>

              {/* SÉLECTEUR DE SAISON */}
              <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-slate-400 pl-2">Saison :</span>
                <select
                  value={seasonFilter}
                  onChange={(e) => {
                    const s = parseInt(e.target.value, 10);
                    setSeasonFilter(s);
                    setJourneeFilter(1);
                    if (session?.user?.id) {
                      localStorage.setItem(`season_${session.user.id}`, s);
                      localStorage.setItem(`journee_${session.user.id}`, 1);
                    }
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
                    <th className="py-3 px-2 text-center" title="Matchs Joués">MJ</th>
                    <th className="py-3 px-2 text-center text-emerald-400" title="Victoires">V</th>
                    <th className="py-3 px-2 text-center text-slate-300" title="Matchs Nuls">N</th>
                    <th className="py-3 px-2 text-center text-rose-400" title="Défaites">D</th>
                    <th className="py-3 px-2 text-center text-indigo-300" title="Buts Pour (marqués)">BP</th>
                    <th className="py-3 px-2 text-center text-amber-300" title="Buts Contre (encaissés)">BC</th>
                    <th className="py-3 px-2 text-center" title="Différence de buts / Goal Average">Diff</th>
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
                            <span className={`font-bold transition-colors ${
                              isTopFour 
                                ? 'text-emerald-300 group-hover:text-emerald-200' 
                                : isBottomThree 
                                ? 'text-rose-300 group-hover:text-rose-200' 
                                : 'text-white group-hover:text-indigo-400'
                            }`}>
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
                          <span className={`inline-block font-extrabold px-3 py-1 rounded-full border font-mono ${
                            isTopFour 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                              : isBottomThree 
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' 
                              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          }`}>
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

        {/* 2. MATCHS */}
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
                {/* SÉLECTEUR DE SAISON */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 pl-1.5">Saison :</span>
                  <select
                    value={seasonFilter}
                    onChange={(e) => {
                      const s = parseInt(e.target.value, 10);
                      setSeasonFilter(s);
                      setJourneeFilter(1);
                      if (session?.user?.id) {
                        localStorage.setItem(`season_${session.user.id}`, s);
                        localStorage.setItem(`journee_${session.user.id}`, 1);
                      }
                    }}
                    className="bg-slate-900 border border-slate-700 text-indigo-400 font-bold text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {availableSeasons.map((s) => (
                      <option key={s} value={s}>{getSeasonLabel(s)}</option>
                    ))}
                  </select>
                </div>

                {/* PROGRESSION DES JOURNÉES */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
                  <button
                    type="button"
                    onClick={handlePrevJournee}
                    disabled={journeeFilter <= 1}
                    className="bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 text-white text-xs font-bold w-8 h-8 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
                    title="Journée précédente"
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
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95 shadow-indigo-600/30'
                    }`}
                    title={!isCurrentJourneeCompleted ? "Simulez ou jouez d'abord la journée en cours" : "Passer à la journée suivante"}
                  >
                    ▶
                  </button>
                </div>

                {/* BOUTON SAUVEGARDER LA PROGRESSION */}
                <button
                  type="button"
                  onClick={handleSaveTournamentProgress}
                  disabled={savingProgress}
                  className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="Enregistrer la saison et journée actuelles"
                >
                  <span>💾</span> {savingProgress ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>

                {/* BOUTON DE SIMULATION */}
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
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-2.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                    title="Réinitialiser complètement la saison 1 (clubs & joueurs de base)"
                  >
                    🔄
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartNewSeason(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Lancer la saison suivante (garde les effectifs actuels)"
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
                    type="button"
                    onClick={() => handleStartNewSeason(false)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/30 cursor-pointer flex items-center gap-2 mx-auto"
                  >
                    <span>🔄</span> Générer le Calendrier de la {getSeasonLabel(seasonFilter)}
                  </button>
                </div>
              ) : (
                seasonMatches
                  .filter((m) => m.journee === parseInt(journeeFilter, 10))
                  .sort((a, b) => (a.id > b.id ? 1 : -1))
                  .map((m) => {
                    const currentDomInput = scoresInput[m.id]?.dom !== undefined ? scoresInput[m.id].dom : (m.score_domicile ?? '');
                    const currentExtInput = scoresInput[m.id]?.ext !== undefined ? scoresInput[m.id].ext : (m.score_exterieur ?? '');

                    return (
                      <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                        {/* ÉQUIPE DOMICILE */}
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

                        {/* CENTRE : BOUTON DÉ 🎲 À GAUCHE DU SCORE DOMICILE, INPUTS ET BOUTON VS */}
                        <div className="flex items-center justify-center gap-2 sm:gap-2.5 shrink-0 my-2 sm:my-0">
                          <button
                            type="button"
                            onClick={() => handleRollDice(m.id)}
                            className="bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 text-sm font-black p-2.5 rounded-xl transition-all cursor-pointer shadow-md active:scale-95 select-none mr-1"
                            title="Lancer les dés (Donne un score aléatoire de 1 à 6 avec probabilités égales)"
                          >
                            🎲
                          </button>

                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={currentDomInput}
                            onChange={(e) => handleScoreInputChange(m.id, 'dom', e.target.value)}
                            className="w-12 h-11 sm:w-14 sm:h-12 bg-slate-950 text-white font-mono font-black text-xl text-center rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />

                          <button
                            type="button"
                            onClick={() => openMatchDetails(m)}
                            className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-black tracking-widest px-3.5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md active:scale-95 uppercase select-none"
                            title="Cliquer pour voir les buteurs, passeurs, cartons et changements"
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
                            title="Valider le score et ajouter les événements (buteurs, passeurs...)"
                          >
                            ✓
                          </button>
                        </div>

                        {/* ÉQUIPE EXTÉRIEURE */}
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
                  onChange={(e) => {
                    const s = parseInt(e.target.value, 10);
                    setSeasonFilter(s);
                    if (session?.user?.id) {
                      localStorage.setItem(`season_${session.user.id}`, s);
                    }
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
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">🔄 Marché des Transferts</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Règle officielle : <strong>16 joueurs min</strong>, <strong>28 joueurs max</strong> et <strong>3 transferts max / journée en hiver</strong>.
                  </p>
                </div>

                {transfers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAllTransfers}
                    className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md active:scale-95"
                    title="Annuler tous les transferts et réassigner les joueurs à leur équipe initiale"
                  >
                    <span>🗑️</span> Réinitialiser tous les transferts
                  </button>
                )}
              </div>

              <form onSubmit={handleTransferPlayer} className="space-y-5 max-w-2xl mt-4">
                <div>
                  <label className="block text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
                    1. Club de provenance (Seulement clubs avec &gt; 16 joueurs)
                  </label>
                  <select
                    value={transferFromTeamId}
                    onChange={handleFromTeamChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="">-- Choisir l'équipe de départ --</option>
                    {availableSellerTeams.map((t) => {
                      const count = players.filter(p => p.equipe_id === t.id).length;
                      return (
                        <option key={t.id} value={t.id}>{t.nom} ({count} joueurs)</option>
                      );
                    })}
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
                      <p className="text-xs text-slate-400">Valeur marchande actuelle</p>
                      <p className="text-sm font-bold text-emerald-400">{formatMoney(selectedTransferPlayer.valeur_marchande)}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">
                      3. Club de destination (Seulement clubs avec &lt; 28 joueurs)
                    </label>
                    <select
                      value={transferToTeamId}
                      onChange={(e) => setTransferToTeamId(e.target.value)}
                      disabled={!transferPlayerId}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                      required
                    >
                      <option value="">-- Choisir la nouvelle équipe --</option>
                      {availableDestinationTeams.map((t) => {
                        const count = players.filter(p => p.equipe_id === t.id).length;
                        return (
                          <option key={t.id} value={t.id}>{t.nom} ({count}/28 joueurs)</option>
                        );
                      })}
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

            {/* Historique des 15 Derniers Transferts */}
            {transfers.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">📋 Historique des 15 Derniers Transferts</h3>
                  <span className="text-xs text-slate-400 font-mono">Affichage : {Math.min(transfers.length, 15)} / 15 max</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                        <th className="py-3 px-4">Joueur</th>
                        <th className="py-3 px-4">Ancien Club</th>
                        <th className="py-3 px-4">Nouveau Club</th>
                        <th className="py-3 px-4 text-right">Montant</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-sm">
                      {transfers.slice(0, 15).map((t) => (
                        <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-white">{t.players?.nom || 'Joueur inconnu'}</td>
                          <td className="py-3.5 px-4 text-rose-400 font-semibold">{t.old_team?.nom || '-'}</td>
                          <td className="py-3.5 px-4 text-emerald-400 font-semibold">{t.new_team?.nom || '-'}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-300">
                            {formatMoney(t.fee)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleCancelTransfer(t)}
                              className="bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer active:scale-95"
                              title="Annuler ce transfert et renvoyer le joueur dans son ancien club"
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

        {/* 5. ADMIN */}
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

              {/* CRÉATION DE JOUEUR AVEC CHAMP VALEUR MARCHANDE */}
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
                      {teams.map((t) => {
                        const count = players.filter(p => p.equipe_id === t.id).length;
                        return (
                          <option key={t.id} value={t.id}>{t.nom} ({count}/28 jrs)</option>
                        );
                      })}
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

            {/* GESTION DES SAISONS */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🔄</span> 3. Gestion des Saisons & Calendriers
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    Réinitialiser (🔄) remet tous les joueurs dans leur club d'origine. Lancer la saison suivante (🚀) conserve tous vos effectifs actuels et démarre un nouveau championnat.
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
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-3 rounded-xl text-sm transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span>🔄</span> Réinitialiser Saison 1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartNewSeason(true)}
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

      {/* --- MODALE MERCATO D'HIVER --- */}
      {mercatoReport && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button
              type="button"
              onClick={() => setMercatoReport(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center mb-5 pb-3 border-b border-slate-800">
              <div className="inline-block bg-indigo-600 text-white p-2.5 rounded-2xl text-xl mb-2 shadow-lg shadow-indigo-600/30">❄️</div>
              <h3 className="text-xl font-black text-white tracking-tight">MERCATO D'HIVER EN DIRECT</h3>
              <p className="text-xs text-indigo-400 font-semibold mt-0.5">
                3 Nouveaux transferts officiels après la <strong>Journée {mercatoReport.journee}</strong> ({mercatoReport.seasonLabel})
              </p>
            </div>

            <div className="overflow-y-auto space-y-3 max-h-96 pr-1">
              {mercatoReport.transfers.map((t) => (
                <div key={t.id} className="bg-slate-950/80 border border-slate-800/90 p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-900 text-indigo-300 border border-slate-800 font-mono">
                      {t.poste || 'MC'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-white">{t.nom}</p>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                          {t.general} GEN
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">{t.age} ans</span>
                      </div>
                      <p className="text-[11px] text-slate-500 italic mt-0.5">{t.reason}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/60">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <span className="text-rose-400 truncate max-w-[90px] text-right">{t.oldTeam}</span>
                      <span className="text-slate-500">➜</span>
                      <span className="text-emerald-400 truncate max-w-[90px]">{t.newTeam}</span>
                    </div>

                    <span className="text-xs font-black font-mono px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 whitespace-nowrap">
                      {formatMoney(t.fee)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setMercatoReport(null)}
              className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              Fermer le Point Mercato
            </button>
          </div>
        </div>
      )}

      {/* --- MODALE RAPPORT D'ÉVOLUTION --- */}
      {evolutionReport && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button
              type="button"
              onClick={() => setEvolutionReport(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center mb-4 pb-3 border-b border-slate-800">
              <div className="inline-block bg-indigo-600 text-white p-2 rounded-xl text-lg mb-2">📈</div>
              <h3 className="text-lg font-black text-white tracking-tight">Rapport d'Évolution des Notes & Valeurs</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Bilan des performances sur les <strong className="text-indigo-400">{evolutionReport.journeesLabel}</strong> ({evolutionReport.seasonLabel}) • Max 3 joueurs par club
              </p>
            </div>

            <div className="overflow-y-auto space-y-2.5 max-h-96 pr-1">
              {evolutionReport.players.map((p) => {
                const isPositive = p.delta > 0;
                return (
                  <div key={p.id} className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold px-2 py-1 rounded bg-slate-900 text-indigo-400 border border-slate-800">
                        {p.poste || 'MC'}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-white">{p.nom}</p>
                        <p className="text-[11px] text-slate-400">
                          {p.teamName} {p.buts > 0 && `• ⚽ ${p.buts}`} {p.passes > 0 && `• 🎯 ${p.passes}`}
                        </p>
                        <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
                          Valeur : {formatMoney(p.newVal)} • Cumul Saison : <strong className="text-indigo-300">{p.seasonTotal > 0 ? `+${p.seasonTotal}` : p.seasonTotal}/3</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs text-slate-500 font-mono line-through mr-1.5">{p.oldGen}</span>
                        <span className="text-base font-black text-white font-mono">{p.newGen}</span>
                      </div>
                      <span className={`text-xs font-black font-mono px-2.5 py-1 rounded-xl border ${
                        isPositive 
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                          : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      }`}>
                        {isPositive ? `+${p.delta}` : p.delta}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setEvolutionReport(null)}
              className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              Compris ! Continuer la saison
            </button>
          </div>
        </div>
      )}

      {/* --- MODALE TERRAIN TACTIQUE --- */}
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

      {/* --- MODALE EFFECTIF ÉQUIPE --- */}
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
                  <p className="text-xs text-indigo-400 font-semibold">{teamRoster.length} joueurs dans l'effectif complet ({teamRoster.length}/28)</p>
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
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Général (45-99)</label>
                  <input
                    type="number"
                    min="40"
                    max="99"
                    value={editingPlayer.general !== undefined && editingPlayer.general !== null ? editingPlayer.general : 75}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, general: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
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

      {/* --- MODALE FEUILLE DE MATCH --- */}
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
                      } else if (ev.type === 'remplacement') {
                        icon = '🔄';
                        typeLabel = 'Entrée';
                        colorClass = 'text-emerald-400';
                      }

                      return (
                        <div key={ev.id} className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-slate-400 text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                              {ev.minute ? `${ev.minute}'` : "45'"}
                            </span>
                            <span className="text-sm">{icon}</span>
                            <span className="font-semibold text-white truncate text-xs">
                              {ev.player_nom}
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
                      } else if (ev.type === 'remplacement') {
                        icon = '🔄';
                        typeLabel = 'Entrée';
                        colorClass = 'text-emerald-400';
                      }

                      return (
                        <div key={ev.id} className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-slate-400 text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                              {ev.minute ? `${ev.minute}'` : "45'"}
                            </span>
                            <span className="text-sm">{icon}</span>
                            <span className="font-semibold text-white truncate text-xs">
                              {ev.player_nom}
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
