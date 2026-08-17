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
    const { data: dataClassement } = await supabase
      .from('classement')
      .select('*')
      .order('points', { ascending: false });
    if (dataClassement) setClassement(dataClassement);

    const { data: dataButeurs } = await supabase
      .from('players')
      .select('*, teams(nom, logo_url)')
      .order('valeur_marchande', { ascending: false });
    if (dataButeurs) setButeurs(dataButeurs);

    const { data: dataTeams } = await supabase.from('teams').select('*').order('nom');
    if (dataTeams) setTeams(dataTeams);

    const { data: dataMatches } = await supabase
      .from('matches')
      .select('*, dom:teams!equipe_domicile_id(nom, logo_url), ext:teams!equipe_exterieur_id(nom, logo_url)');
    if (dataMatches) setMatches(dataMatches);
  }

  // 1. Ajouter Équipe avec Upload sécurisé
  async function handleAddTeam(e) {
    e.preventDefault();
    if (!newTeamName) return;

    setUploading(true);
    let logoUrl = '';

    if (logoFile) {
      // Nettoyage strict du nom du fichier pour éviter 'Invalid path'
      const cleanFileName = `${Date.now()}_logo.png`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('logos')
        .upload(cleanFileName, logoFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        showNotif(`Erreur upload image: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('logos')
        .getPublicUrl(cleanFileName);

      logoUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabase.from('teams').insert([{
      nom: newTeamName,
      logo_url: logoUrl
    }]);

    setUploading(false);

    if (error) {
      showNotif(`Erreur création équipe: ${error.message}`);
    } else {
      showNotif(`Équipe "${newTeamName}" créée avec succès !`);
      setNewTeamName('');
      setLogoFile(null);
      fetchData();
    }
  }

  // 2. Ajouter un Joueur
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
      showNotif(`Erreur: ${error.message}`);
    } else {
      showNotif(`Joueur "${newPlayer.nom}" ajouté !`);
      setNewPlayer({ nom: '', equipe_id: newPlayer.equipe_id, general: 75, valeur: 10000000, age: 22 });
      fetchData();
    }
  }

  // 3. Créer un Match
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
      showNotif(`Erreur: ${error.message}`);
    } else {
      showNotif("Match programmé !");
      fetchData();
    }
  }

  // 4. Valider le score
  async function handleUpdateScore(matchId, scoreDom, scoreExt) {
    const { error } = await supabase.from('matches').update({
      score_domicile: parseInt(scoreDom),
      score_exterieur: parseInt(scoreExt),
      statut: 'terminé'
    }).eq('id', matchId);

    if (!error) {
      showNotif("Résultat enregistré et classement mis à jour !");
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
                    <th className="py-3 px-4 text-center">Joués</th>
                    <th className="py-3 px-4 text-center">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {classement.map((eq, i) => {
                    const fullTeam = teams.find((t) => t.id === eq.id);
                    return (
                      <tr key={eq.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 px-4 font-mono font-bold text-slate-400">{i + 1}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {fullTeam?.logo_url ? (
                              <img src={fullTeam.logo_url} alt="" className="w-7 h-7 object-contain rounded-full bg-slate-800 p-0.5" />
                            ) : (
                              <div className="w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center text-xs">🛡️</div>
                            )}
                            <span className="font-semibold text-white">{eq.nom}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center text-slate-300 font-medium">{eq.joues}</td>
                        <td className="py-4 px-4 text-center">
                          <span className="inline-block bg-indigo-500/10 text-indigo-400 font-extrabold px-3 py-1 rounded-full border border-indigo-500/20">
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>📅</span> Calendrier des Rencontres
                </h2>
                <p className="text-xs text-slate-400 mt-1">Sélectionnez la journée de championnat</p>
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

            <div className="grid gap-4 sm:grid-cols-2">
              {matches
                .filter((m) => m.journee === parseInt(journeeFilter))
                .map((m) => (
                  <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
                    <div className="flex items-center gap-3 w-5/12">
                      {m.dom?.logo_url ? (
                        <img src={m.dom.logo_url} className="w-8 h-8 object-contain" alt="" />
                      ) : (
                        <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-xs">🛡️</div>
                      )}
                      <span className="font-semibold text-sm truncate text-white">{m.dom?.nom}</span>
                    </div>

                    <div className="w-2/12 text-center">
                      {m.statut === 'terminé' ? (
                        <div className="bg-slate-950 px-3 py-1.5 rounded-lg font-mono font-bold text-indigo-400 text-sm border border-slate-800">
                          {m.score_domicile} - {m.score_exterieur}
                        </div>
                      ) : (
                        <span className="text-xs font-bold bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full uppercase tracking-wider">VS</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 w-5/12 justify-end text-right">
                      <span className="font-semibold text-sm truncate text-white">{m.ext?.nom}</span>
                      {m.ext?.logo_url ? (
                        <img src={m.ext.logo_url} className="w-8 h-8 object-contain" alt="" />
                      ) : (
                        <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-xs">🛡️</div>
                      )}
                    </div>
                  </div>
                ))}
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
                        {(j.valeur_marchande).toLocaleString()} €
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
                    {uploading ? 'Envoi du logo en cours...' : '+ Ajouter l\'équipe'}
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

            {/* Saisir Score */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4">4. Valider les Résultats</h3>
              <div className="space-y-3">
                {matches.filter((m) => m.statut !== 'terminé').map((m) => (
                  <div key={m.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-300">
                      Journée {m.journee} : <strong className="text-white">{m.dom?.nom}</strong> vs <strong className="text-white">{m.ext?.nom}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <input type="number" id={`dom-${m.id}`} defaultValue="0" className="w-12 bg-slate-900 border border-slate-700 rounded-lg py-1 px-2 text-center text-sm text-white" />
                      <span className="text-slate-500 font-bold">-</span>
                      <input type="number" id={`ext-${m.id}`} defaultValue="0" className="w-12 bg-slate-900 border border-slate-700 rounded-lg py-1 px-2 text-center text-sm text-white" />
                      <button
                        onClick={() => {
                          const sDom = document.getElementById(`dom-${m.id}`).value;
                          const sExt = document.getElementById(`ext-${m.id}`).value;
                          handleUpdateScore(m.id, sDom, sExt);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all ml-2"
                      >
                        Valider
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
