import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRow } from '../api/sheets';

export function useProjects() {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [projData, msData] = await Promise.all([
        readSheet(token, 'Projects!A2:M'),
        readSheet(token, 'Milestones!A2:F'),
      ]);
      setProjects(projData);
      setMilestones(msData);
    } catch (err) {
      console.error('Failed to fetch Projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addProject = useCallback(async (entry) => {
    const values = [
      entry.code, entry.name, entry.budget || '',
      entry.estLabour || '', entry.estMaterial || '', entry.estMachine || '', entry.estOther || '',
      entry.startDate || '', entry.endDatePlanned || '', '',
      entry.manager || '', entry.status || 'Not Started', entry.notes || '',
    ];
    await appendRow(token, 'Projects!A:M', values);
    await fetchData();
  }, [token, fetchData]);

  const addMilestone = useCallback(async (entry) => {
    const values = [
      entry.project, entry.milestone,
      entry.plannedDate || '', entry.actualDate || '',
      entry.status || 'Not Started', entry.notes || '',
    ];
    await appendRow(token, 'Milestones!A:F', values);
    await fetchData();
  }, [token, fetchData]);

  const parsedProjects = projects.map((row) => ({
    code: row[0] || '',
    name: row[1] || '',
    budget: parseFloat(row[2]) || 0,
    estLabour: parseFloat(row[3]) || 0,
    estMaterial: parseFloat(row[4]) || 0,
    estMachine: parseFloat(row[5]) || 0,
    estOther: parseFloat(row[6]) || 0,
    startDate: row[7] || '',
    endDatePlanned: row[8] || '',
    endDateActual: row[9] || '',
    manager: row[10] || '',
    status: row[11] || '',
    notes: row[12] || '',
  }));

  const parsedMilestones = milestones.map((row) => ({
    project: row[0] || '',
    milestone: row[1] || '',
    plannedDate: row[2] || '',
    actualDate: row[3] || '',
    status: row[4] || '',
    notes: row[5] || '',
  }));

  return {
    projects: parsedProjects,
    milestones: parsedMilestones,
    isLoading,
    addProject,
    addMilestone,
    refresh: fetchData,
  };
}
