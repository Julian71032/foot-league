import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function App() {
  const [tab, setTab] = useState('classement'); // 'classement', 'buteurs', 'matchs', 'admin'
  const [classement, setClassement] = useState([]);
  const [buteurs, setButeurs] = useState([]);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [journeeFilter, setJourneeFilter] = useState(1);

  // Formulaires Admin
  const [newTeam, setNewTeam] = useState({ nom: '', logo_url: '' });
  const [newPlayer, setNewPlayer] = useState({ nom: '', equipe_id: '', general: 70, valeur: 1000000 });
  const [newMatch, setNewMatch] = useState({ dom_id: '', ext_id: '', journee: 1 });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: dataClassement } = await supabase.from('classement').select('*').order('points', { ascending: false });
    if (dataClassement) setClassement(dataClassement);

    const { data: dataButeurs } = await supabase.from('players').select('*, teams(nom, logo_url)').order('valeur_marchande', { ascending: false });
    if (dataButeurs) setButeurs(dataButeurs);

    const { data: dataTeams } = await supabase.from('teams').select('*');
    if (dataTeams) setTeams(dataTeams);

    const { data: dataMatches } = await supabase.from('matches').select('*, dom:teams!equipe_domicile_id(nom, logo_url), ext:teams!equipe_exterieur_id(nom, logo_url)');
    if (dataMatches) setMatches(dataMatches);
  }

  // Ajouter Équipe avec Logo
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
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <h1>⚽ Ligue de Football</h1>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={() => setTab('classement')}>🏆 Classement</button>
        <button onClick={() => setTab('matchs')}>📅 Calendrier & Matchs</button>
        <button onClick={() => setTab('buteurs')}>👟 Joueurs & Valeurs</button>
        <button onClick={() => setTab('admin')} style={{ background: '#333', color: '#fff' }}>⚙️ Admin</button>
      </div>

      {/* 1. CLASSEMENT */}
      {tab === 'classement' && (
        <div>
          <h2>Classement Général</h2>
          <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f4f4f4' }}>
                <th>Pos</th>
                <th>Équipe</th>
                <th>Joués</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {classement.map((eq, i) => {
                const fullTeam = teams.find(t => t.id === eq.id);
                return (
                  <tr key={eq.id}>
                    <td>{i + 1}</td>
                    <td style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {fullTeam?.logo_url && <img src={fullTeam.logo_url} alt="" style={{ width: '25px', height: '25px', objectFit: 'contain' }} />}
                      <strong>{eq.nom}</strong>
                    </td>
                    <td>{eq.joues}</td>
                    <td><strong style={{ color: 'blue' }}>{eq.points}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. MATCHS PAR JOURNÉE */}
      {tab === 'matchs' && (
        <div>
          <h2>Calendrier des Matchs</h2>
          <label>Sélectionner la Journée : </label>
          <input type="number" min="1" max="38" value={journeeFilter} onChange={e => setJourneeFilter(e.target.value)} style={{ marginBottom: '15px', padding: '5px' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {matches.filter(m => m.journee === parseInt(journeeFilter)).map(m => (
              <div key={m.id} style={{ border: '1px solid #ccc', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '35%' }}>
                  {m.dom?.logo_url && <img src={m.dom.logo_url} style={{ width: '20px' }} />}
                  <span>{m.dom?.nom}</span>
                </div>
                <div>
                  <strong>{m.statut === 'terminé' ? `${m.score_domicile} - ${m.score_exterieur}` : 'VS'}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '35%', justifyContent: 'flex-end' }}>
                  <span>{m.ext?.nom}</span>
                  {m.ext?.logo_url && <img src={m.ext.logo_url} style={{ width: '20px' }} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. JOUEURS */}
      {tab === 'buteurs' && (
        <div>
          <h2>Valeur Marchande des Joueurs</h2>
          <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f4f4f4' }}>
                <th>Joueur</th>
                <th>Équipe</th>
                <th>Général</th>
                <th>Valeur</th>
              </tr>
            </thead>
            <tbody>
              {buteurs.map((j) => (
                <tr key={j.id}>
                  <td><strong>{j.nom}</strong></td>
                  <td>{j.teams?.nom}</td>
                  <td>{j.general}</td>
                  <td><strong style={{ color: 'green' }}>{(j.valeur_marchande).toLocaleString()} €</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. ADMIN */}
      {tab === 'admin' && (
        <div>
          <h2>Panneau d'Administration</h2>

          {/* Ajouter Équipe */}
          <div style={{ background: '#f9f9f9', padding: '15px', marginBottom: '15px' }}>
            <h3>1. Ajouter une Équipe</h3>
            <form onSubmit={handleAddTeam} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Nom" value={newTeam.nom} onChange={e => setNewTeam({...newTeam, nom: e.target.value})} required />
              <input type="url" placeholder="URL du Logo (ex: https://...)" value={newTeam.logo_url} onChange={e => setNewTeam({...newTeam, logo_url: e.target.value})} />
              <button type="submit">Créer</button>
            </form>
          </div>

          {/* Créer un Match */}
          <div style={{ background: '#f9f9f9', padding: '15px', marginBottom: '15px' }}>
            <h3>2. Programmer un Match</h3>
            <form onSubmit={handleAddMatch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input type="number" placeholder="Journée ex: 1" value={newMatch.journee} onChange={e => setNewMatch({...newMatch, journee: e.target.value})} required />
              <select onChange={e => setNewMatch({...newMatch, dom_id: e.target.value})} required>
                <option value="">Équipe Domicile</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
              </select>
              <select onChange={e => setNewMatch({...newMatch, ext_id: e.target.value})} required>
                <option value="">Équipe Extérieur</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
              </select>
              <button type="submit">Ajouter le match</button>
            </form>
          </div>

          {/* Saisir Score */}
          <div style={{ background: '#f9f9f9', padding: '15px' }}>
            <h3>3. Saisir les Scores</h3>
            {matches.filter(m => m.statut !== 'terminé').map(m => (
              <div key={m.id} style={{ marginBottom: '10px' }}>
                <span>J{m.journee} : {m.dom?.nom} VS {m.ext?.nom}</span>
                <input type="number" id={`dom-${m.id}`} defaultValue="0" style={{ width: '40px', marginLeft: '10px' }} />
                <span> - </span>
                <input type="number" id={`ext-${m.id}`} defaultValue="0" style={{ width: '40px' }} />
                <button style={{ marginLeft: '10px' }} onClick={() => {
                  const sDom = document.getElementById(`dom-${m.id}`).value;
                  const sExt = document.getElementById(`ext-${m.id}`).value;
                  handleUpdateScore(m.id, sDom, sExt);
                }}>Valider le résultat</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
