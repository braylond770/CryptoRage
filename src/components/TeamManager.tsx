import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

interface Team {
  id: number;
  name: string;
  created_by: string;
}

interface TeamMember {
  id: number;
  team_id: number;
  walletAddress: string;
}

interface TeamManagerProps {
  walletAddress: string;
  onTeamSelect: (teamId: number | null) => void;
}

const TeamManager: React.FC<TeamManagerProps> = ({ walletAddress, onTeamSelect }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newMemberAddress, setNewMemberAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams();
  }, [walletAddress]);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamMembers(selectedTeam);
    }
  }, [selectedTeam]);

  const fetchTeams = async () => {
    try {
      const { data: teamMemberData, error: teamMemberError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('walletAddress', walletAddress);
  
      if (teamMemberError) throw teamMemberError;
  
      const teamIds = teamMemberData.map(tm => tm.team_id);
  
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .or(`created_by.eq.${walletAddress},id.in.(${teamIds.join(',')})`);
  
      if (teamsError) throw teamsError;
  
      setTeams(teamsData || []);
    } catch (err) {
      console.error('Failed to fetch teams:', err);
      setError('Failed to fetch teams');
    }
  };

  const handleTeamSelect = (teamId: number | null) => {
    setSelectedTeam(teamId);
    onTeamSelect(teamId);
  };

  const fetchTeamMembers = async (teamId: number) => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId);

    if (error) {
      setError('Failed to fetch team members');
    } else {
      setTeamMembers(data || []);
    }
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) {
      setError('Team name cannot be empty');
      return;
    }

    const { data, error } = await supabase
      .from('teams')
      .insert({ name: newTeamName.trim(), created_by: walletAddress })
      .select();

    if (error) {
      setError('Failed to create team');
    } else if (data) {
      setTeams([...teams, data[0]]);
      setNewTeamName('');
      setError(null);
    }
  };

  const addTeamMember = async () => {
    if (!selectedTeam) {
      setError('Please select a team first');
      return;
    }

    if (!newMemberAddress.trim()) {
      setError('Member address cannot be empty');
      return;
    }

    const { data, error } = await supabase
      .from('team_members')
      .insert({ team_id: selectedTeam, walletAddress: newMemberAddress.trim() })
      .select();

    if (error) {
      setError('Failed to add team member');
    } else if (data) {
      setTeamMembers([...teamMembers, data[0]]);
      setNewMemberAddress('');
      setError(null);
    }
  };

  return (
    <div className="bg-[#2c2f4a] p-4 rounded-lg">
      <h2 className="text-xl font-bold text-white mb-4">Team Management</h2>
      
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">Create New Team</h3>
        <input
          type="text"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          placeholder="Team Name"
          className="bg-[#1a1b2e] text-white p-2 rounded w-full mb-2"
        />
        <button
          onClick={createTeam}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          Create Team
        </button>
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">Your Teams</h3>
        <select
          value={selectedTeam || ''}
          onChange={(e) => handleTeamSelect(e.target.value ? Number(e.target.value) : null)}
          className="bg-[#1a1b2e] text-white p-2 rounded w-full"
        >
          <option value="">Select a team</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
      </div>

      {selectedTeam && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Team Members</h3>
          <ul className="mb-4">
            {teamMembers.map((member) => (
              <li key={member.id} className="text-white">{member.walletAddress}</li>
            ))}
          </ul>
          <input
            type="text"
            value={newMemberAddress}
            onChange={(e) => setNewMemberAddress(e.target.value)}
            placeholder="New Member Wallet Address"
            className="bg-[#1a1b2e] text-white p-2 rounded w-full mb-2"
          />
          <button
            onClick={addTeamMember}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
          >
            Add Member
          </button>
        </div>
      )}

      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
};

export default TeamManager;