import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [tab, setTab] = useState('classement');
  const [classement, setClassement] = useState([]);
  const [buteurs, setButeurs] = useState([]);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [journeeFilter, setJourneeFilter] = useState(1);

  // Formulaires Admin
  const [newTeam, setNewTeam] = useState({ nom: '', logo_url: '' });
  const [newMatch, setNewMatch] = useState({ dom_id: '', ext_id: '', journee: 1 });

  useEffect(() => {
    // Injecter Tailwind CDN dynamiquement
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
    fetchData();
  }, []);

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

    const { data: dataTeams } = await supabase.from('teams').select('*');
    if (dataTeams) setTeams(dataTeams);

    const { data: dataMatches } = await supabase
      .from('matches')
      .select('*, dom:teams!equipe_domicile_id(nom, logo_url), ext:teams!equipe_exterieur_id(nom, logo_url)');
    if (dataMatches) setMatches(dataMatches);
  }

  // Ajouter Équipe
  async function handleAddTeam(e) {
    e.preventDefault();
    if (!newTeam.nom) return;
    await supabase.from('teams').insert([{ nom: newTeam.nom, logo_url: newTeam.logo_url }]);
    setNewTeam({ nom: '', logo_url: '' });
    fetchData();
  }

  // Créer un Match
  async function handleAddMatch(e) {
    e.preventDefault();
    if (!newMatch.dom_id || !newMatch.ext_id) return;
    await supabase.from('matches').insert([{
      equipe_domicile_id: newMatch.dom_id,
      equipe_exterieur_id: newMatch.ext_id,
      journee: parseInt(newMatch.journee),
      statut: 'à venir'
    }]);
    fetchData();
  }

  // Valider le score d'un match (Admin)
  async function handleUpdateScore(matchId, scoreDom, scoreExt) {
    await supabase.from('matches').update({
      score_domicile: parseInt(scoreDom),
      score_exterieur: parseInt(scoreExt),
      statut: 'terminé'
    }).eq('id', matchId);
    fetchData();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      {/* Header / Banner */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              ⚽
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white">LIGUE DE FOOTBALL</h1>
              <p className="text-xs text-slate-400 font-medium">Saison Officielle & Stats</p>
            </div>
          </div>

          {/* Navigation */}
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

        {/* 2. MATCHS PAR JOURNÉE */}
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
                    {/* Domicile */}
                    <div className="flex items-center gap-3 w-5/12">
                      {m.dom?.logo_url ? (
                        <img src={m.dom.logo_url} className="w-8 h-8 object-contain" alt="" />
                      ) : (
                        <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-xs">🛡️</div>
                      )}
                      <span className="font-semibold text-sm truncate text-white">{m.dom?.nom}</span>
                    </div>

                    {/* Score / VS */}
                    <div className="w-2/12 text-center">
                      {m.statut === 'terminé' ? (
                        <div className="bg-slate-950 px-3 py-1.5 rounded-lg font-mono font-bold text-indigo-400 text-sm border border-slate-800">
                          {m.score_domicile} - {m.score_exterieur}
                        </div>
                      ) : (
                        <span className="text-xs font-bold bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full uppercase tracking-wider">VS</span>
                      )}
                    </div>

                    {/* Extérieur */}
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
              <span>👟</span> Liste des Joueurs
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Joueur</th>
                    <th className="py-3 px-4">Équipe</th>
                    <th className="py-3 px-4 text-center">Général</th>
                    <th className="py-3 px-4 text-right">Valeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {buteurs.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-4 font-semibold text-white">{j.nom}</td>
                      <td className="py-4 px-4 text-slate-300">{j.teams?.nom || 'Sans club'}</td>
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
            <h2 className="text-2xl font-extrabold text-white">⚙️ Administration</h2>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Ajouter Équipe */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4">1. Ajouter une Équipe</h3>
                <form onSubmit={handleAddTeam} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Nom de l'équipe</label>
                    <input
                      type="text"
                      placeholder="Ex: Arsenal"
                      value={newTeam.nom}
                      onChange={(e) => setNewTeam({ ...newTeam, nom: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">URL du Logo (Lien Image)</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={newTeam.logo_url}
                      onChange={(e) => setNewTeam({ ...newTeam, logo_url: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20">
                    Ajouter l'équipe
                  </button>
                </form>
              </div>

              {/* Créer un Match */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4">2. Programmer un Match</h3>
                <form onSubmit={handleAddMatch} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Journée</label>
                    <input
                      type="number"
                      value={newMatch.journee}
                      onChange={(e) => setNewMatch({ ...newMatch, journee: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Domicile</label>
                      <select
                        onChange={(e) => setNewMatch({ ...newMatch, dom_id: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
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
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        required
                      >
                        <option value="">Sélectionner</option>
                        {teams.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20">
                    Enregistrer le match
                  </button>
                </form>
              </div>
            </div>

            {/* Saisir Score */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4">3. Valider les Résultats</h3>
              <div className="space-y-3">
                {matches.filter((m) => m.statut !== 'terminé').map((m) => (
                  <div key={m.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-300">
                      J{m.journee} : {m.dom?.nom} vs {m.ext?.nom}
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
