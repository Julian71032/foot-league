import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [tab, setTab] = useState('classement');
  const [classement, setClassement] = useState([]);
  const [buteurs, setButeurs] = useState([]);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [journeeFilter, setJourneeFilter] = useState(1);
  const [notification, setNotification] = useState('');

  // Stockage temporaire des scores saisis dans la grille
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
    // 1. Charger les équipes / classement triés par points
    const { data: dataTeams } = await supabase
      .from('teams')
      .select('*')
      .order('points', { ascending: false });
    if (dataTeams) {
      setTeams(dataTeams);
      setClassement(dataTeams);
    }

    // 2. Charger les joueurs
    const { data: dataButeurs } = await supabase
      .from('players')
      .select('*, teams(nom, logo_url)')
      .order('valeur_marchande', { ascending: false });
    if (dataButeurs) setButeurs(dataButeurs);

    // 3. Charger les matchs avec leurs équipes
    const { data: dataMatches } = await supabase
      .from('matches')
      .select('*, dom:teams!equipe_domicile_id(id, nom, logo_url, points), ext:teams!equipe_exterieur_id(id, nom, logo_url, points)');
    if (dataMatches) setMatches(dataMatches);
  }

  // Gestion des inputs de score dans l'onglet Matchs
  function handleScoreInputChange(matchId, teamType, val) {
    setScoresInput(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [teamType]: val
      }
    }));
  }

  // Enregistrer le score et attribuer les +3, +1 ou +0 points
  async function handleSaveMatchScore(match) {
    const matchScores = scoresInput[match.id] || {};
    const scoreDom = parseInt(matchScores.dom !== undefined ? matchScores.dom : match.score_domicile);
    const scoreExt = parseInt(matchScores.ext !== undefined ? matchScores.ext : match.score_exterieur);

    if (isNaN(scoreDom) || isNaN(scoreExt)) {
      showNotif("Veuillez saisir un score valide pour les deux équipes.");
      return;
    }

    // Calcul des points selon les règles du football
    let ptsDom = 0;
    let ptsExt = 0;

    if (scoreDom > scoreExt) {
      ptsDom = 3;
      ptsExt = 0;
    } else if (scoreDom < scoreExt) {
      ptsDom = 0;
      ptsExt = 3;
    } else {
      ptsDom = 1;
      ptsExt = 1;
    }

    // Récupérer les équipes de la mémoire locale pour avoir leurs points actuels
    const teamDom = teams.find(t => t.id === match.equipe_domicile_id);
    const teamExt = teams.find(t => t.id === match.equipe_exterieur_id);

    const currentPtsDom = teamDom ? (teamDom.points || 0) : 0;
    const currentPtsExt = teamExt ? (teamExt.points || 0) : 0;

    // 1. Mettre à jour le match
    const { error: matchError } = await supabase
      .from('matches')
      .update({
        score_domicile: scoreDom,
        score_exterieur: scoreExt,
        statut: 'terminé'
      })
      .eq('id', match.id);

    if (matchError) {
      showNotif(`Erreur match : ${matchError.message}`);
      return;
    }

    // 2. Mettre à jour les points de l'équipe domicile
    if (teamDom) {
      await supabase
        .from('teams')
        .update({ points: currentPtsDom + ptsDom })
        .eq('id', teamDom.id);
    }

    // 3. Mettre à jour les points de l'équipe extérieure
    if (teamExt) {
      await supabase
        .from('teams')
        .update({ points: currentPtsExt + ptsExt })
        .eq('id', teamExt.id);
    }

    showNotif(`Résultat enregistré (${scoreDom} - ${scoreExt}). Points mis à jour !`);
    fetchData();
  }

  // 1. Admin : Ajouter Équipe (Mode Base64 Sécurisé)
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
        showNotif(`Erreur lecture image : ${err.message}`);
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

    if (error) {
      showNotif(`Erreur création équipe : ${error.message}`);
    } else {
      showNotif(`Équipe "${newTeamName}" créée avec succès !`);
      setNewTeamName('');
      setLogoFile(null);
      fetchData();
    }
  }

  // 2. Admin : Ajouter un Joueur
  async function handleAddPlayer(e) {
    e.preventDefault();
    if (!newPlayer.nom || !newPlayer.equipe_id) {
      showNotif("Veuillez sélectionner une équipe et entrer le nom du joueur.");
      return;
    }

    const { error } = await supabase.from('players').insert([{
      nom: newPlayer.nom,
      equipe_id: newPlayer.equipe_id,
      general: parseInt(newPlayer.general),
      valeur_marchande: parseInt(newPlayer.valeur),
      age: parseInt(newPlayer.age)
    }]);

    if (error) {
      showNotif(`Erreur : ${error.message}`);
    } else {
      showNotif(`Joueur "${newPlayer.nom}" ajouté !`);
      setNewPlayer({ nom: '', equipe_id: newPlayer.equipe_id, general: 75, valeur: 10000000, age: 22 });
      fetchData();
    }
  }

  // 3. Admin : Créer un Match
  async function handleAddMatch(e) {
    e.preventDefault();
    if (!newMatch.dom_id || !newMatch.ext_id) return;

    const { error } = await supabase.from('matches').insert([{
      equipe_domicile_id: newMatch.dom_id,
      equipe_exterieur_id: newMatch.ext_id,
      journee: parseInt(newMatch.journee),
      statut: 'à venir'
    }]);

    if (error) {
      showNotif(`Erreur : ${error.message}`);
    } else {
      showNotif("Match programmé !");
      fetchData();
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              ⚽
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white">LIGUE DE FOOTBALL</h1>
              <p className="text-xs text-slate-400 font-medium">Saison Officielle & Live Stats</p>
            </div>
          </div>

          <nav className="flex items-center bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80">
            {[
              { id: 'classement', label: '🏆 Classement' },
              { id: 'matchs', label: '📅 Matchs' },
              { id: 'buteurs', label: '👟 Joueurs' },
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

      {/* Notification Toast */}
      {notification && (
        <div className="max-w-md mx-auto mt-4 px-4">
          <div className="bg-indigo-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl text-center border border-indigo-400">
            {notification}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 mt-8">
        {/* 1. CLASSEMENT */}
        {tab === 'classement' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
              <span>🏆</span> Classement Général
            </h2>
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
                    <tr key={eq.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-slate-400">{i + 1}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {eq.logo_url ? (
                            <img src={eq.logo_url} alt="" className="w-7 h-7 object-contain rounded-full bg-slate-800 p-0.5" />
                          ) : (
                            <div className="w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center text-xs">🛡️</div>
                          )}
                          <span className="font-semibold text-white">{eq.nom}</span>
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

        {/* 2. MATCHS (AVEC CASES SCORE INTÉGRÉES AUTOUR DU VS) */}
        {tab === 'matchs' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>📅</span> Calendrier des Rencontres
                </h2>
                <p className="text-xs text-slate-400 mt-1">Saisissez les scores et appuyez sur Valider pour mettre à jour le classement</p>
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
                      {/* Équipe Domicile */}
                      <div className="flex items-center gap-3 sm:w-4/12 justify-start w-full">
                        {m.dom?.logo_url ? (
                          <img src={m.dom.logo_url} className="w-10 h-10 object-contain" alt="" />
                        ) : (
                          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-xs">🛡️</div>
                        )}
                        <span className="font-bold text-base text-white truncate">{m.dom?.nom}</span>
                      </div>

                      {/* Blocs Score + VS au milieu */}
                      <div className="flex items-center gap-3 sm:w-4/12 justify-center my-2 sm:my-0">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={currentDomInput}
                          onChange={(e) => handleScoreInputChange(m.id, 'dom', e.target.value)}
                          className="w-14 h-11 bg-slate-950 text-white font-mono font-bold text-lg text-center rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 shadow-inner"
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
                          className="w-14 h-11 bg-slate-950 text-white font-mono font-bold text-lg text-center rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 shadow-inner"
                        />
                      </div>

                      {/* Équipe Extérieure + Bouton Valider */}
                      <div className="flex items-center gap-3 sm:w-4/12 justify-end w-full">
                        <span className="font-bold text-base text-white truncate text-right">{m.ext?.nom}</span>
                        {m.ext?.logo_url ? (
                          <img src={m.ext.logo_url} className="w-10 h-10 object-contain" alt="" />
                        ) : (
                          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-xs">🛡️</div>
                        )}

                        <button
                          onClick={() => handleSaveMatchScore(m)}
                          className="ml-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/20 active:scale-95"
                        >
                          Valider
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* 3. JOUEURS */}
        {tab === 'buteurs' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
              <span>👟</span> Base des Joueurs
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Joueur</th>
                    <th className="py-3 px-4">Équipe</th>
                    <th className="py-3 px-4 text-center">Âge</th>
                    <th className="py-3 px-4 text-center">Général</th>
                    <th className="py-3 px-4 text-right">Valeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {buteurs.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-4 font-semibold text-white">{j.nom}</td>
                      <td className="py-4 px-4 text-slate-300">
                        <div className="flex items-center gap-2">
                          {j.teams?.logo_url && <img src={j.teams.logo_url} alt="" className="w-5 h-5 object-contain" />}
                          <span>{j.teams?.nom || 'Sans club'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center text-slate-400 font-mono">{j.age || '-'} ans</td>
                      <td className="py-4 px-4 text-center">
                        <span className="bg-slate-800 text-amber-400 font-bold px-2.5 py-1 rounded-md text-xs border border-amber-500/20">
                          {j.general}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-emerald-400">
                        {(j.valeur_marchande || 0).toLocaleString()} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. ADMIN */}
        {tab === 'admin' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-extrabold text-white">⚙️ Panneau d'Administration</h2>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Ajouter Équipe */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4">1. Créer une Équipe</h3>
                <form onSubmit={handleAddTeam} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Nom de l'équipe</label>
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
                    <label className="block text-xs font-medium text-slate-400 mb-1">Fichier Logo (PNG, JPG, SVG)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files[0])}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20"
                  >
                    {uploading ? 'Chargement de l\'image...' : '+ Ajouter l\'équipe'}
                  </button>
                </form>
              </div>

              {/* Ajouter un Joueur */}
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
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Âge</label>
                      <input
                        type="number"
                        value={newPlayer.age}
                        onChange={(e) => setNewPlayer({ ...newPlayer, age: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Général</label>
                      <input
                        type="number"
                        value={newPlayer.general}
                        onChange={(e) => setNewPlayer({ ...newPlayer, general: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Valeur (€)</label>
                      <input
                        type="number"
                        value={newPlayer.valeur}
                        onChange={(e) => setNewPlayer({ ...newPlayer, valeur: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-600/20 mt-2">
                    + Ajouter le joueur
                  </button>
                </form>
              </div>
            </div>

            {/* Programmer Match */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4">3. Programmer une Rencontre</h3>
              <form onSubmit={handleAddMatch} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Journée</label>
                  <input
                    type="number"
                    value={newMatch.journee}
                    onChange={(e) => setNewMatch({ ...newMatch, journee: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Domicile</label>
                  <select
                    onChange={(e) => setNewMatch({ ...newMatch, dom_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="">Sélectionner</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-xl text-sm transition-all">
                    Programmer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
