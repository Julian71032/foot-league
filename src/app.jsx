import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function App() {
  const [tab, setTab] = useState('classement'); // 'classement', 'buteurs', 'admin'
  const [classement, setClassement] = useState([]);
  const [buteurs, setButeurs] = useState([]);
  const [teams, setTeams] = useState([]);
  
  // Formulaires Admin
  const [newTeam, setNewTeam] = useState('');
  const [newPlayer, setNewPlayer] = useState({ nom: '', equipe_id: '', general: 70, valeur: 1000000 });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    // 1. Charger le classement
    const { data: dataClassement } = await supabase.from('classement').select('*').order('points', { ascending: false });
    if (dataClassement) setClassement(dataClassement);

    // 2. Charger les joueurs / buteurs
    const { data: dataButeurs } = await supabase.from('players').select('*, teams(nom)').order('valeur_marchande', { ascending: false });
    if (dataButeurs) setButeurs(dataButeurs);

    // 3. Charger les équipes pour l'admin
    const { data: dataTeams } = await supabase.from('teams').select('*');
    if (dataTeams) setTeams(dataTeams);
  }

  // Action Admin : Ajouter une équipe
  async function handleAddTeam(e) {
    e.preventDefault();
    if (!newTeam) return;
    await supabase.from('teams').insert([{ nom: newTeam }]);
    setNewTeam('');
    fetchData();
  }

  // Action Admin : Ajouter un joueur
  async function handleAddPlayer(e) {
    e.preventDefault();
    if (!newPlayer.nom || !newPlayer.equipe_id) return;
    await supabase.from('players').insert([{
      nom: newPlayer.nom,
      equipe_id: newPlayer.equipe_id,
      general: parseInt(newPlayer.general),
      valeur_marchande: parseInt(newPlayer.valeur)
    }]);
    setNewPlayer({ nom: '', equipe_id: '', general: 70, valeur: 1000000 });
    fetchData();
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <h1>⚽ Ligue de Football</h1>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => setTab('classement')} style={{ padding: '10px 15px', fontWeight: tab === 'classement' ? 'bold' : 'normal' }}>🏆 Classement</button>
        <button onClick={() => setTab('buteurs')} style={{ padding: '10px 15px', fontWeight: tab === 'buteurs' ? 'bold' : 'normal' }}>👟 Joueurs & Valeurs</button>
        <button onClick={() => setTab('admin')} style={{ padding: '10px 15px', background: '#333', color: '#fff' }}>⚙️ Panneau Admin</button>
      </div>

      {/* Vue 1: Classement */}
      {tab === 'classement' && (
        <div>
          <h2>Classement Général</h2>
          <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f4f4f4' }}>
                <th>Pos</th>
                <th>Équipe</th>
                <th>Joués</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {classement.map((eq, i) => (
                <tr key={eq.id}>
                  <td>{i + 1}</td>
                  <td><strong>{eq.nom}</strong></td>
                  <td>{eq.joues}</td>
                  <td><strong style={{ color: 'blue' }}>{eq.points}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vue 2: Joueurs & Valeur Marchande */}
      {tab === 'buteurs' && (
        <div>
          <h2>Joueurs & Valeur Marchande</h2>
          <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f4f4f4' }}>
                <th>Joueur</th>
                <th>Équipe</th>
                <th>Général</th>
                <th>Valeur Marchande</th>
              </tr>
            </thead>
            <tbody>
              {buteurs.map((j) => (
                <tr key={j.id}>
                  <td><strong>{j.nom}</strong></td>
                  <td>{j.teams?.nom || 'Sans club'}</td>
                  <td>{j.general}</td>
                  <td><strong style={{ color: 'green' }}>{(j.valeur_marchande).toLocaleString()} €</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vue 3: Admin */}
      {tab === 'admin' && (
        <div>
          <h2>Panneau d'Administration</h2>
          
          <div style={{ background: '#f9f9f9', padding: '15px', marginBottom: '20px', borderRadius: '5px' }}>
            <h3>1. Ajouter une Équipe</h3>
            <form onSubmit={handleAddTeam} style={{ display: 'flex', gap: '10px' }}>
              <input type="text" placeholder="Nom de l'équipe" value={newTeam} onChange={e => setNewTeam(e.target.value)} required />
              <button type="submit">Créer l'équipe</button>
            </form>
          </div>

          <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '5px' }}>
            <h3>2. Ajouter un Joueur</h3>
            <form onSubmit={handleAddPlayer} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px' }}>
              <input type="text" placeholder="Nom du joueur" value={newPlayer.nom} onChange={e => setNewPlayer({...newPlayer, nom: e.target.value})} required />
              <select value={newPlayer.equipe_id} onChange={e => setNewPlayer({...newPlayer, equipe_id: e.target.value})} required>
                <option value="">Sélectionner une équipe</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
              </select>
              <label>Général (Note): <input type="number" value={newPlayer.general} onChange={e => setNewPlayer({...newPlayer, general: e.target.value})} /></label>
              <label>Valeur (€): <input type="number" value={newPlayer.valeur} onChange={e => setNewPlayer({...newPlayer, valeur: e.target.value})} /></label>
              <button type="submit">Créer le joueur</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
