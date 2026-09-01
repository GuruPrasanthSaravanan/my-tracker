import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { readSheet, appendRowAt, updateRow } from '../api/sheets';
import { parsePayoffPriority } from '../utils/priorityOrdering';

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
        readSheet(token, 'Projects!A2:N1000'),
        readSheet(token, 'Milestones!A2:F2000'),
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
      entry.manager || '', entry.status || 'Not Started', entry.notes || '', entry.payoffPriority || '',
    ];
    await appendRowAt(token, 'Projects', 'N', projects.length, values);
    await fetchData();
  }, [token, fetchData, projects]);

  // `skipRefresh` lets a caller writing several projects back-to-back (e.g.
  // PriorityOrderManager's savePriorityOrder) skip the full-tab refetch
  // after every single write and do just one at the end instead - without
  // it, saving N projects triggers N sequential refetches, each causing an
  // intermediate re-render (visible as UI flicker) before settling.
  const editProject = useCallback(async (rowIndex, entry, { skipRefresh = false } = {}) => {
    const sheetRow = rowIndex + 2;
    const values = [
      entry.code, entry.name, entry.budget || '',
      entry.estLabour || '', entry.estMaterial || '', entry.estMachine || '', entry.estOther || '',
      entry.startDate || '', entry.endDatePlanned || '', entry.endDateActual || '',
      entry.manager || '', entry.status || '', entry.notes || '', entry.payoffPriority || '',
    ];
    await updateRow(token, `Projects!A${sheetRow}:N${sheetRow}`, values);
    if (!skipRefresh) await fetchData();
  }, [token, fetchData]);

  const addMilestone = useCallback(async (entry) => {
    const values = [
      entry.project, entry.milestone,
      entry.plannedDate || '', entry.actualDate || '',
      entry.status || 'Not Started', entry.notes || '',
    ];
    await appendRowAt(token, 'Milestones', 'F', milestones.length, values);
    await fetchData();
  }, [token, fetchData, milestones]);

  const parsedProjects = projects.map((row, index) => ({
    _rowIndex: index,
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
    payoffPriority: parsePayoffPriority(row[13]),
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
    editProject,
    addMilestone,
    refresh: fetchData,
  };
}
