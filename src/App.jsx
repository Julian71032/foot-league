import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [tab, setTab] = useState('classement');
  const [classement, setClassement] = useState([]);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [journeeFilter, setJourneeFilter] = useState(1);
  const [notification, setNotification] = useState('');

  // Modale Détails Match
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchEvents, setMatchEvents] = useState([]);
  const [eventPlayerId, setEventPlayerId] = useState('');
  const [eventType, setEventType] = useState('but');

  // Modale Détails Équipe (Effectif)
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Scores saisis
  const [scoresInput, setScoresInput] = useState({});

  // Formulaires Admin
  const [newTeamName, setNewTeamName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ nom: '', equipe_id: '', general: 75, valeur: 10000000, age: 22 });
  const [newMatch, setNewMatch] = useState({ dom_id: '', ext_id: '', journee: 1 });

  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
    fetchData();
  }, []);

  function showNotif(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  }

  async function fetchData() {
    // 1. Équipes
    const { data: dataTeams } = await supabase
      .from('teams')
      .select('*')
      .order('points', { ascending: false });
    if (dataTeams) {
      setTeams(dataTeams);
      setClassement(dataTeams);
    }

    // 2. Joueurs
    const { data: dataPlayers } = await supabase
      .from('players')
      .select('*, teams(nom, logo_url)');
    if (dataPlayers) setPlayers(dataPlayers);

    // 3. Matchs
    const { data: dataMatches } = await supabase
      .from('matches')
      .select('*, dom:teams!equipe_domicile_id(id, nom, logo_url, points), ext:teams!equipe_exterieur_id(id, nom, logo_url, points)');
    if (dataMatches) setMatches(dataMatches);
  }

  // --- DÉTAILS MATCH ---
  async function openMatchDetails(match) {
    setSelectedMatch(match);
    fetchMatchEvents(match.id);
  }

  async function fetchMatchEvents(matchId) {
    const { data } = await supabase
      .from('match_events')
      .select('*, players(nom, equipe_id)')
      .eq('match_id', matchId);
    if (data) setMatchEvents(data);
  }

  async function handleAddMatchEvent(e) {
    e.preventDefault();
    if (!eventPlayerId || !selectedMatch) return;

    const { error } = await supabase.from('match_events').insert([{
      match_id: selectedMatch.id,
      player_id: eventPlayerId,
      type: eventType
    }]);

    if (error) {
      showNotif(`Erreur : ${error.message}`);
      return;
    }

    const player = players.find(p => p.id === eventPlayerId);
    if (player) {
      const updateData = eventType === 'but'
        ? { buts: (player.buts || 0) + 1 }
        : { passes_decisives: (player.passes_decisives || 0) + 1 };

      await supabase.from('players').update(updateData).eq('id', eventPlayerId);
    }

    showNotif(`${eventType === 'but' ? '⚽ But' : '🎯 Passe'} enregistré !`);
    fetchMatchEvents(selectedMatch.id);
    fetchData();
  }

  async function handleDeleteMatchEvent(event) {
    await supabase.from('match_events').delete().eq('id', event.id);

    const player = players.find(p => p.id === event.player_id);
    if (player) {
      const updateData = event.type === 'but'
        ? { buts: Math.max(0, (player.buts || 0) - 1) }
        : { passes_decisives: Math.max(0, (player.passes_decisives || 0) - 1) };

      await supabase.from('players').update(updateData).eq('id', event.player_id);
    }

    showNotif("Événement retiré.");
    fetchMatchEvents(selectedMatch.id);
    fetchData();
  }

  // --- SCORES & POINTS ---
  function handleScoreInputChange(matchId, teamType, val) {
    setScoresInput(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], [teamType]: val }
    }));
  }

  async function handleSaveMatchScore(match) {
    const matchScores = scoresInput[match.id] || {};
    const scoreDom = parseInt(matchScores.dom !== undefined ? matchScores.dom : match.score_domicile);
    const scoreExt = parseInt(matchScores.ext !== undefined ? matchScores.ext : match.score_exterieur);

    if (isNaN(scoreDom) || isNaN(scoreExt)) {
      showNotif("Veuillez saisir un score valide.");
      return;
    }

    let ptsDom = 0, ptsExt = 0;
    if (scoreDom > scoreExt) { ptsDom = 3; }
    else if (scoreDom < scoreExt) { ptsExt = 3; }
    else { ptsDom = 1; ptsExt = 1; }

    const teamDom = teams.find(t => t.id === match.equipe_domicile_id);
    const teamExt = teams.find(t => t.id === match.equipe_exterieur_id);

    await supabase.from('matches').update({
      score_domicile: scoreDom,
      score_exterieur: scoreExt,
      statut: 'terminé'
    }).eq('id', match.id);

    if (teamDom) {
      await supabase.from('teams').update({ points: (teamDom.points || 0) + ptsDom }).eq('id', teamDom.id);
    }
    if (teamExt) {
      await supabase.from('teams').update({ points: (teamExt.points || 0) + ptsExt }).eq('id', teamExt.id);
    }

    showNotif(`Score enregistré (${scoreDom} - ${scoreExt}). Points mis à jour !`);
    fetchData();
  }

  // --- ADMIN HANDLERS ---
  async function handleAddTeam(e) {
    e.preventDefault();
    if (!newTeamName) return;
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

    const { error } = await supabase.from('teams').insert([{ nom: newTeamName, logo_url: logoUrl, points: 0 }]);
    setUploading(false);

    if (error) {
      showNotif(`Erreur : ${error.message}`);
    } else {
      showNotif(`Équipe "${newTeamName}" créée !`);
      setNewTeamName('');
      setLogoFile(null);
      fetchData();
    }
  }

  async function handleAddPlayer(e) {
    e.preventDefault();
    if (!newPlayer.nom || !newPlayer.equipe_id) return;

    const { error } = await supabase.from('players').insert([{
      nom: newPlayer.nom,
      equipe_id: newPlayer.equipe_id,
      general: parseInt(newPlayer.general),
      valeur_marchande: parseInt(newPlayer.valeur),
      age: parseInt(newPlayer.age),
      buts: 0,
      passes_decisives: 0
    }]);

    if (error) showNotif(`Erreur : ${error.message}`);
    else {
      showNotif(`Joueur "${newPlayer.nom}" ajouté !`);
      setNewPlayer({ nom: '', equipe_id: newPlayer.equipe_id, general: 75, valeur: 10000000, age: 22 });
      fetchData();
    }
  }

  async function handleAddMatch(e) {
    e.preventDefault();
    if (!newMatch.dom_id || !newMatch.ext_id) return;

    const { error } = await supabase.from('matches').insert([{
      equipe_domicile_id: newMatch.dom_id,
      equipe_exterieur_id: newMatch.ext_id,
      journee: parseInt(newMatch.journee),
      statut: 'à venir'
    }]);

    if (error) showNotif(`Erreur : ${error.message}`);
    else {
      showNotif("Match programmé !");
      fetchData();
    }
  }

  function formatMoney(amount) {
    if (!amount) return '0 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
  }

  const teamRoster = selectedTeam
    ? players.filter(p => p.equipe_id === selectedTeam.id).sort((a, b) => (b.general || 0) - (a.general || 0))
    : [];

  const topButeurs = [...players].sort((a, b) => (b.buts || 0) - (a.buts || 0));
  const topPasseurs = [...players].sort((a, b) => (b.passes_decisives || 0) - (a.passes_decisives || 0));

  const matchPlayers = selectedMatch
    ? players.filter(p => p.equipe_id === selectedMatch.equipe_domicile_id || p.equipe_id === selectedMatch.equipe_exterieur_id)
    : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">⚽</div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white">LIGUE DE FOOTBALL</h1>
              <p className="text-xs text-slate-400 font-medium">Saison Officielle & Live Stats</p>
            </div>
          </div>

          <nav className="flex items-center bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80">
            {[
              { id: 'classement', label: '🏆 Classement' },
              { id: 'matchs', label: '📅 Matchs' },
              { id: 'buteurs', label: '👟 Stats Joueurs' },
              { id: 'admin', label: '⚙️ Admin' },
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

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 mt-8">
        {/* 1. CLASSEMENT ÉQUIPES */}
        {tab === 'classement' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white">🏆 Classement Général</h2>
              <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">💡 Clique sur une équipe pour voir son effectif</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Équipe</th>
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
                      <td className="py-4 px-4 text-center">
                        <span className="inline-block bg-indigo-500/10 text-indigo-400 font-extrabold px-3 py-1 rounded-full border border-indigo-500/20">
                          {eq.points || 0} pts
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">📅 Calendrier des Rencontres</h2>
                <p className="text-xs text-slate-400 mt-1">Saisissez les scores, validez puis gérez les buteurs dans "Détails"</p>
              </div>

              <div className="flex items-center gap-3 bg-slate-950 p-2 rounded-xl border border-slate-800">
                <span className="text-sm text-slate-400 font-medium pl-2">Journée</span>
                <input
                  type="number"
                  min="1"
                  max="38"
                  value={journeeFilter}
                  onChange={(e) => setJourneeFilter(e.target.value)}
                  className="bg-slate-800 text-white font-bold w-16 px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 text-center"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-1">
              {matches
                .filter((m) => m.journee === parseInt(journeeFilter))
                .map((m) => {
                  const currentDomInput = scoresInput[m.id]?.dom !== undefined ? scoresInput[m.id].dom : (m.score_domicile ?? '');
                  const currentExtInput = scoresInput[m.id]?.ext !== undefined ? scoresInput[m.id].ext : (m.score_exterieur ?? '');

                  return (
                    <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3 sm:w-3/12 justify-start w-full">
                        {m.dom?.logo_url ? (
                          <img src={m.dom.logo_url} className="w-10 h-10 object-contain" alt="" />
                        ) : (
                          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-xs">🛡️</div>
                        )}
                        <span className="font-bold text-base text-white truncate">{m.dom?.nom}</span>
                      </div>

                      <div className="flex items-center gap-3 sm:w-4/12 justify-center my-2 sm:my-0">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={currentDomInput}
                          onChange={(e) => handleScoreInputChange(m.id, 'dom', e.target.value)}
                          className="w-14 h-11 bg-slate-950 text-white font-mono font-bold text-lg text-center rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />

                        <span className="text-xs font-black bg-indigo-600/30 text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-500/20 uppercase tracking-widest">
                          VS
                        </span>

                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={currentExtInput}
                          onChange={(e) => handleScoreInputChange(m.id, 'ext', e.target.value)}
                          className="w-14 h-11 bg-slate-950 text-white font-mono font-bold text-lg text-center rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      <div className="flex items-center gap-2 sm:w-5/12 justify-end w-full">
                        <span className="font-bold text-base text-white truncate text-right mr-2">{m.ext?.nom}</span>
                        {m.ext?.logo_url ? (
                          <img src={m.ext.logo_url} className="w-10 h-10 object-contain mr-2" alt="" />
                        ) : (
                          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-xs mr-2">🛡️</div>
                        )}

                        <button
                          onClick={() => handleSaveMatchScore(m)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/20 active:scale-95"
                        >
                          Valider
                        </button>

                        <button
                          onClick={() => openMatchDetails(m)}
                          className="bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 text-xs font-bold px-3 py-2.5 rounded-xl transition-all active:scale-95"
                        >
                          Détails 📝
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* 3. CLASSEMENT BUTEURS ET PASSEURS */}
        {tab === 'buteurs' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">⚽ Meilleurs Buteurs</h2>
              <div className="overflow-x-auto">
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
                          <div className="font-semibold text-white">{j.nom}</div>
                          <div className="text-xs text-slate-400">{j.teams?.nom}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-amber-400 text-base">
                          {j.buts || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">🎯 Meilleurs Passeurs</h2>
              <div className="overflow-x-auto">
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
                          <div className="font-semibold text-white">{j.nom}</div>
                          <div className="text-xs text-slate-400">{j.teams?.nom}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-indigo-400 text-base">
                          {j.passes_decisives || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. ADMIN */}
        {tab === 'admin' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-extrabold text-white">⚙️ Panneau d'Administration</h2>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Création Équipe */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4">1. Créer une Équipe</h3>
                <form onSubmit={handleAddTeam} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Nom</label>
                    <input
                      type="text"
                      placeholder="Ex: Arsenal"
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
                  <button type="submit" disabled={uploading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-sm">
                    {uploading ? 'Chargement...' : '+ Ajouter l\'équipe'}
                  </button>
                </form>
              </div>

              {/* Création Joueur (AVEC NOTE, ÂGE, ET VALEUR) */}
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
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Nom du joueur</label>
                    <input
                      type="text"
                      placeholder="Ex: Bukayo Saka"
                      value={newPlayer.nom}
                      onChange={(e) => setNewPlayer({ ...newPlayer, nom: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  {/* Champs Générale / Âge / Valeur */}
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

                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-sm mt-2">
                    + Ajouter le joueur
                  </button>
                </form>
              </div>
            </div>

            {/* Programer Match */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4">3. Programmer une Rencontre</h3>
              <form onSubmit={handleAddMatch} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Journée</label>
                  <input
                    type="number"
                    value={newMatch.journee}
                    onChange={(e) => setNewMatch({ ...newMatch, journee: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Domicile</label>
                  <select
                    onChange={(e) => setNewMatch({ ...newMatch, dom_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                    required
                  >
                    <option value="">Sélectionner</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Extérieur</label>
                  <select
                    onChange={(e) => setNewMatch({ ...newMatch, ext_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                    required
                  >
                    <option value="">Sélectionner</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-xl text-sm">
                    Programmer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* --- MODALE DÉTAILS D'UNE ÉQUIPE (EFFECTIF) --- */}
      {selectedTeam && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedTeam(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl"
            >
              ✕
            </button>

            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-800">
              {selectedTeam.logo_url ? (
                <img src={selectedTeam.logo_url} className="w-14 h-14 object-contain rounded-full bg-slate-950 p-1" alt="" />
              ) : (
                <div className="w-14 h-14 bg-slate-950 rounded-full flex items-center justify-center text-xl">🛡️</div>
              )}
              <div>
                <h3 className="text-xl font-extrabold text-white">{selectedTeam.nom}</h3>
                <p className="text-xs text-indigo-400 font-semibold">{teamRoster.length} joueurs dans l'effectif • {selectedTeam.points || 0} points</p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Joueur</th>
                    <th className="py-2.5 px-3 text-center">GEN</th>
                    <th className="py-2.5 px-3 text-center">Âge</th>
                    <th className="py-2.5 px-3 text-center">Buts</th>
                    <th className="py-2.5 px-3 text-center">Passes</th>
                    <th className="py-2.5 px-3 text-right">Valeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm">
                  {teamRoster.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-slate-500 text-xs">
                        Aucun joueur enregistré dans cette équipe pour l'instant.
                      </td>
                    </tr>
                  ) : (
                    teamRoster.map((j) => (
                      <tr key={j.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-semibold text-white">{j.nom}</td>
                        <td className="py-3 px-3 text-center font-extrabold text-emerald-400">
                          <span className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                            {j.general || 75}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center text-slate-300 font-medium">{j.age || '-'} ans</td>
                        <td className="py-3 px-3 text-center text-amber-400 font-bold">⚽ {j.buts || 0}</td>
                        <td className="py-3 px-3 text-center text-indigo-400 font-bold">🎯 {j.passes_decisives || 0}</td>
                        <td className="py-3 px-3 text-right font-mono text-xs text-slate-300">
                          {formatMoney(j.valeur_marchande)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALE FEUILLE DE MATCH --- */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedMatch(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xl"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-white mb-2 text-center">Feuille de Match</h3>
            <p className="text-center text-sm font-semibold text-indigo-400 mb-6">
              {selectedMatch.dom?.nom} ({selectedMatch.score_domicile ?? 0}) VS ({selectedMatch.score_exterieur ?? 0}) {selectedMatch.ext?.nom}
            </p>

            <form onSubmit={handleAddMatchEvent} className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6 space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-400">Ajouter une action</h4>
              
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-white text-xs rounded-lg p-2.5"
                >
                  <option value="but">⚽ But</option>
                  <option value="passe">🎯 Passe décisive</option>
                </select>

                <select
                  value={eventPlayerId}
                  onChange={(e) => setEventPlayerId(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-white text-xs rounded-lg p-2.5"
                  required
                >
                  <option value="">-- Choisir le joueur --</option>
                  {matchPlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-lg">
                + Enregistrer l'action
              </button>
            </form>

            <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Événements du match</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {matchEvents.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">Aucun but ou passe enregistré pour l'instant.</p>
              ) : (
                matchEvents.map(ev => (
                  <div key={ev.id} className="flex items-center justify-between bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50 text-xs">
                    <span className="font-semibold text-white">
                      {ev.type === 'but' ? '⚽ But' : '🎯 Passe D.'} - {ev.players?.nom}
                    </span>
                    <button
                      onClick={() => handleDeleteMatchEvent(ev)}
                      className="text-rose-500 hover:text-rose-400 font-bold px-2"
                    >
                      Supprimer
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
