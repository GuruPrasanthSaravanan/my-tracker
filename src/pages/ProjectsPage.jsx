import { useState } from 'react';
import { useAppData } from '../contexts/DataContext';
import { computeProjectSpent } from '../utils/aggregations';
import ProjectCard from '../components/ProjectCard';
import ProjectDetail from '../components/ProjectDetail';
import FAB from '../components/FAB';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EntryForm from '../components/EntryForm';
import { formatCurrency } from '../utils/formatters';

export default function ProjectsPage() {
  const { projects: projectsData, vendors, lists: listsData } = useAppData();
  const { projects, milestones, isLoading, addProject, editProject, addMilestone, refresh: refreshProjects } = projectsData;
  const { rows: vendorRows, addEntry: addVendorEntry, refresh: refreshVendors } = vendors;
  const { lists, addListItem } = listsData;
  const [selectedProject, setSelectedProject] = useState(null);
  const [showForm, setShowForm] = useState(null); // null | 'project' | 'milestone' | 'expense'
  const [toast, setToast] = useState(null);

  const handleSaveProject = async (entry) => {
    try {
      await addProject(entry);
      setShowForm(null);
      setToast({ message: 'Project saved!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save.', type: 'error' });
    }
  };

  const handleEditProject = async (entry) => {
    try {
      await editProject(selectedProject._rowIndex, entry);
      // Refresh selectedProject with updated data
      setSelectedProject(null);
      setToast({ message: 'Project updated!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to update.', type: 'error' });
    }
  };

  const handleSaveMilestone = async (entry) => {
    try {
      await addMilestone({ ...entry, project: selectedProject?.code });
      setShowForm(null);
      await refreshProjects();
      setToast({ message: 'Milestone saved!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save.', type: 'error' });
    }
  };

  const handleSaveExpense = async (entry) => {
    try {
      await addVendorEntry({
        ...entry,
        project: selectedProject?.code,
      });
      setShowForm(null);
      await refreshVendors();
      setToast({ message: 'Expense saved!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save.', type: 'error' });
    }
  };

  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
  const totalSpent = projects.reduce((sum, p) => sum + computeProjectSpent(vendorRows, p.code), 0);

  return (
    <div>
      {/* Summary */}
      <div className="sticky top-0 bg-gray-50 z-10 pb-3">
        <div className={`${totalSpent > totalBudget ? 'bg-danger' : 'bg-primary'} text-white rounded-2xl p-4 mb-3`}>
          <p className="text-xs opacity-80">Total Project Spend</p>
          <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
          <p className="text-xs opacity-80 mt-1">Budget: {formatCurrency(totalBudget)}</p>
        </div>
      </div>

      {/* Project Cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500">Projects ({projects.length})</h2>
        {isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : projects.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No projects yet. Tap + to add one.</p>
        ) : (
          projects.map((project) => (
            <ProjectCard
              key={project.code}
              project={project}
              spent={computeProjectSpent(vendorRows, project.code)}
              onClick={() => setSelectedProject(project)}
            />
          ))
        )}
      </div>

      <FAB onClick={() => setShowForm('project')} />

      {selectedProject && !showForm && (
        <ProjectDetail
          project={selectedProject}
          spent={computeProjectSpent(vendorRows, selectedProject.code)}
          milestones={milestones}
          vendorRows={vendorRows}
          onAddMilestone={() => setShowForm('milestone')}
          onAddExpense={() => setShowForm('expense')}
          onEditProject={handleEditProject}
          onClose={() => setSelectedProject(null)}
        />
      )}

      {showForm === 'project' && (
        <EntryForm
          type="project"
          lists={lists}
          onSave={handleSaveProject}
          onClose={() => setShowForm(null)}
          onAddListItem={addListItem}
          existingProjectCodes={projects.map((p) => p.code)}
        />
      )}

      {showForm === 'milestone' && (
        <EntryForm
          type="milestone"
          lists={lists}
          onSave={handleSaveMilestone}
          onClose={() => setShowForm(null)}
          onAddListItem={addListItem}
        />
      )}

      {showForm === 'expense' && (
        <EntryForm
          type="vendors"
          lists={lists}
          onAddListItem={addListItem}
          initialData={{
            date: new Date().toISOString().split('T')[0],
            vendor: '',
            description: '',
            project: selectedProject?.code || '',
            amount: '',
            direction: 'in',
          }}
          onSave={handleSaveExpense}
          onClose={() => setShowForm(null)}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
