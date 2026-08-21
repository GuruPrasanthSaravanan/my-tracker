import { useState } from 'react';
import { useAppData } from '../contexts/DataContext';
import EMILoanCard from '../components/EMILoanCard';
import EMILoanForm from '../components/EMILoanForm';
import EMILoanDetail from '../components/EMILoanDetail';
import EMIPrepaymentForm from '../components/EMIPrepaymentForm';
import HandLoanRow from '../components/HandLoanRow';
import HandLoanForm from '../components/HandLoanForm';
import HandLoanDetail from '../components/HandLoanDetail';
import HandLoanPaymentForm from '../components/HandLoanPaymentForm';
import CreditCardCard from '../components/CreditCardCard';
import CreditCardForm from '../components/CreditCardForm';
import CreditCardDetail from '../components/CreditCardDetail';
import CreditCardBillForm from '../components/CreditCardBillForm';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { formatCurrency } from '../utils/formatters';
import { Plus } from 'lucide-react';

const SECTIONS = [
  { key: 'emi', label: 'EMI Loans' },
  { key: 'hand', label: 'Hand Loans' },
  { key: 'card', label: 'Credit Cards' },
];

export default function DebtsPage() {
  const { emiLoans, handLoans, creditCards } = useAppData();
  const [section, setSection] = useState('emi');
  const [toast, setToast] = useState(null);
  const notify = (message, type = 'success') => setToast({ message, type });
  const onErr = () => notify('Something went wrong. Please try again.', 'error');

  // ----- EMI state -----
  const [showEMIForm, setShowEMIForm] = useState(false);
  const [selectedEMILoan, setSelectedEMILoan] = useState(null);
  const [editingEMILoan, setEditingEMILoan] = useState(false);
  const [showPrepaymentForm, setShowPrepaymentForm] = useState(false);
  const [editingPrepayment, setEditingPrepayment] = useState(null);

  // ----- Hand loan state -----
  const [showHandForm, setShowHandForm] = useState(null); // null | 'Owe' | 'Lent'
  const [selectedHandLoan, setSelectedHandLoan] = useState(null);
  const [editingHandLoan, setEditingHandLoan] = useState(false);
  const [showHandPaymentForm, setShowHandPaymentForm] = useState(false);
  const [editingHandPayment, setEditingHandPayment] = useState(null);

  // ----- Credit card state -----
  const [showCardForm, setShowCardForm] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [editingCard, setEditingCard] = useState(false);
  const [showBillForm, setShowBillForm] = useState(false);
  const [editingBill, setEditingBill] = useState(null);

  // ===== EMI handlers =====
  const handleSaveEMI = async (entry) => {
    try {
      if (editingEMILoan && selectedEMILoan) {
        await emiLoans.editLoan(selectedEMILoan._rowIndex, entry);
      } else {
        await emiLoans.addLoan(entry);
      }
      setShowEMIForm(false);
      setEditingEMILoan(false);
      setSelectedEMILoan(null);
      notify('EMI loan saved!');
    } catch { onErr(); }
  };

  const handleDeleteEMI = async () => {
    try {
      await emiLoans.deleteLoan(selectedEMILoan._rowIndex);
      setShowEMIForm(false);
      setEditingEMILoan(false);
      setSelectedEMILoan(null);
      notify('EMI loan deleted.');
    } catch { onErr(); }
  };

  const handleSavePrepayment = async ({ date, amount, notes }) => {
    try {
      if (editingPrepayment) {
        await emiLoans.editPrepayment(editingPrepayment._rowIndex, [selectedEMILoan.name, date, amount, notes]);
      } else {
        await emiLoans.addPrepayment(selectedEMILoan.name, date, amount, notes);
      }
      setShowPrepaymentForm(false);
      setEditingPrepayment(null);
      notify('Part-payment saved!');
    } catch { onErr(); }
  };

  const handleDeletePrepayment = async () => {
    try {
      await emiLoans.deletePrepayment(editingPrepayment._rowIndex);
      setShowPrepaymentForm(false);
      setEditingPrepayment(null);
      notify('Part-payment deleted.');
    } catch { onErr(); }
  };

  // ===== Hand loan handlers =====
  const handleSaveHandLoan = async (entry) => {
    try {
      if (editingHandLoan && selectedHandLoan) {
        await handLoans.editLoan(selectedHandLoan._rowIndex, entry);
      } else {
        await handLoans.addLoan(entry);
      }
      setShowHandForm(null);
      setEditingHandLoan(false);
      setSelectedHandLoan(null);
      notify('Saved!');
    } catch { onErr(); }
  };

  const handleDeleteHandLoan = async () => {
    try {
      await handLoans.deleteLoan(selectedHandLoan._rowIndex);
      setShowHandForm(null);
      setEditingHandLoan(false);
      setSelectedHandLoan(null);
      notify('Deleted.');
    } catch { onErr(); }
  };

  const handleRecordHandPayment = async (amount, date) => {
    try {
      await handLoans.addPayment(selectedHandLoan.name, amount, date);
      setShowHandPaymentForm(false);
      setSelectedHandLoan(null);
      notify('Payment recorded!');
    } catch { onErr(); }
  };

  const handleEditHandPayment = async (amount, date) => {
    try {
      const p = editingHandPayment;
      await handLoans.editPayment(p._rowIndex, [p.loanName, date, amount, p.interestPaid, p.principalPaid, p.remainingPrincipal]);
      setEditingHandPayment(null);
      notify('Payment updated!');
    } catch { onErr(); }
  };

  const handleDeleteHandPayment = async () => {
    try {
      await handLoans.deletePayment(editingHandPayment._rowIndex);
      setEditingHandPayment(null);
      notify('Payment deleted.');
    } catch { onErr(); }
  };

  // ===== Credit card handlers =====
  const handleSaveCard = async (entry) => {
    try {
      if (editingCard && selectedCard) {
        await creditCards.editCard(selectedCard._rowIndex, entry);
      } else {
        await creditCards.addCard(entry);
      }
      setShowCardForm(false);
      setEditingCard(false);
      setSelectedCard(null);
      notify('Credit card saved!');
    } catch { onErr(); }
  };

  const handleDeleteCard = async () => {
    try {
      await creditCards.deleteCard(selectedCard._rowIndex);
      setShowCardForm(false);
      setEditingCard(false);
      setSelectedCard(null);
      notify('Credit card deleted.');
    } catch { onErr(); }
  };

  const handleSaveBill = async (entry) => {
    try {
      if (editingBill) {
        await creditCards.editBill(editingBill._rowIndex, entry);
      } else {
        await creditCards.addBill(entry);
      }
      setShowBillForm(false);
      setEditingBill(null);
      notify('Bill saved!');
    } catch { onErr(); }
  };

  const handleDeleteBill = async () => {
    try {
      await creditCards.deleteBill(editingBill._rowIndex);
      setShowBillForm(false);
      setEditingBill(null);
      notify('Bill deleted.');
    } catch { onErr(); }
  };

  return (
    <div>
      {/* Segmented Toggle */}
      <div className="sticky top-0 bg-gray-50 z-10 pb-3">
        <div className="flex bg-gray-100 rounded-xl p-1">
          {SECTIONS.map((s) => (
            <button key={s.key} onClick={() => setSection(s.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                section === s.key ? 'bg-white shadow-sm text-primary' : 'text-gray-500'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ----- EMI Loans Section ----- */}
      {section === 'emi' && (
        <div>
          <div className="bg-primary text-white rounded-2xl p-4 mb-3">
            <p className="text-xs opacity-80">Total EMI Outstanding</p>
            <p className="text-2xl font-bold">{formatCurrency(emiLoans.totalOutstanding)}</p>
            <p className="text-xs opacity-80 mt-1">Monthly EMI: {formatCurrency(emiLoans.totalMonthlyEMI)}</p>
          </div>

          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-500">EMI Loans ({emiLoans.loans.length})</h2>
            <button onClick={() => { setEditingEMILoan(false); setSelectedEMILoan(null); setShowEMIForm(true); }}
              className="text-xs text-primary font-medium flex items-center gap-1">
              <Plus size={14} /> Add EMI Loan
            </button>
          </div>

          {emiLoans.isLoading ? (
            <LoadingSkeleton rows={4} />
          ) : emiLoans.loans.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No EMI loans yet. Tap "Add EMI Loan" to add one.</p>
          ) : (
            <div className="space-y-3">
              {emiLoans.loans.map((loan) => (
                <EMILoanCard key={loan._rowIndex} loan={loan} onClick={() => setSelectedEMILoan(loan)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ----- Hand Loans Section ----- */}
      {section === 'hand' && (
        <div>
          <div className="bg-danger text-white rounded-2xl p-4 mb-3">
            <p className="text-xs opacity-80">Total Owed (Principal + Accrued Interest)</p>
            <p className="text-2xl font-bold">{formatCurrency(handLoans.totalOwed)}</p>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-500">Debts I Owe ({handLoans.debts.length})</h2>
              <button onClick={() => setShowHandForm('Owe')} className="text-xs text-primary font-medium flex items-center gap-1">
                <Plus size={14} /> Add Debt
              </button>
            </div>
            {handLoans.isLoading ? (
              <LoadingSkeleton rows={4} />
            ) : handLoans.debts.length === 0 ? (
              <p className="text-center text-gray-400 py-4">No hand loans tracked.</p>
            ) : (
              handLoans.debts.map((loan) => (
                <HandLoanRow key={loan._rowIndex} loan={loan} onClick={() => setSelectedHandLoan(loan)} />
              ))
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-500">Money I Lent ({handLoans.lends.length})</h2>
              <button onClick={() => setShowHandForm('Lent')} className="text-xs text-primary font-medium flex items-center gap-1">
                <Plus size={14} /> Add Lend
              </button>
            </div>
            {handLoans.totalLent > 0 && (
              <div className="bg-amber-50 rounded-lg p-3 mb-2">
                <p className="text-xs text-amber-700">Total Outstanding Lends</p>
                <p className="text-lg font-bold text-amber-600">{formatCurrency(handLoans.totalLent)}</p>
              </div>
            )}
            {handLoans.lends.length === 0 ? (
              <p className="text-center text-gray-400 py-4">No money lent out.</p>
            ) : (
              handLoans.lends.map((loan) => (
                <HandLoanRow key={loan._rowIndex} loan={loan} onClick={() => setSelectedHandLoan(loan)} />
              ))
            )}
          </div>
        </div>
      )}

      {/* ----- Credit Cards Section ----- */}
      {section === 'card' && (
        <div>
          <div className="bg-danger text-white rounded-2xl p-4 mb-3">
            <p className="text-xs opacity-80">Total Outstanding Across Cards</p>
            <p className="text-2xl font-bold">{formatCurrency(creditCards.totalOutstanding)}</p>
          </div>

          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-500">Credit Cards ({creditCards.cards.length})</h2>
            <button onClick={() => { setEditingCard(false); setSelectedCard(null); setShowCardForm(true); }}
              className="text-xs text-primary font-medium flex items-center gap-1">
              <Plus size={14} /> Add Card
            </button>
          </div>

          {creditCards.isLoading ? (
            <LoadingSkeleton rows={4} />
          ) : creditCards.cards.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No credit cards yet. Tap "Add Card" to add one.</p>
          ) : (
            <div className="space-y-3">
              {creditCards.cards.map((card) => (
                <CreditCardCard key={card._rowIndex} card={card} onClick={() => setSelectedCard(card)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== EMI Modals ===== */}
      {showEMIForm && !editingEMILoan && (
        <EMILoanForm onSave={handleSaveEMI} onClose={() => setShowEMIForm(false)} />
      )}

      {selectedEMILoan && !editingEMILoan && !showEMIForm && !showPrepaymentForm && (
        <EMILoanDetail
          loan={selectedEMILoan}
          onEdit={() => setEditingEMILoan(true)}
          onAddPrepayment={() => { setEditingPrepayment(null); setShowPrepaymentForm(true); }}
          onEditPrepayment={(p) => { setEditingPrepayment(p); setShowPrepaymentForm(true); }}
          onClose={() => setSelectedEMILoan(null)}
        />
      )}

      {selectedEMILoan && editingEMILoan && (
        <EMILoanForm
          initial={{
            name: selectedEMILoan.name,
            principal: String(selectedEMILoan.principal),
            annualRate: String(selectedEMILoan.annualRate),
            tenureMonths: String(selectedEMILoan.tenureMonths),
            startDate: selectedEMILoan.startDate,
            debitsFrom: selectedEMILoan.debitsFrom,
            status: selectedEMILoan.status,
            notes: selectedEMILoan.notes,
            emiDate: selectedEMILoan.emiDate ? String(selectedEMILoan.emiDate) : '',
            actualEMI: selectedEMILoan.actualEMI ? String(selectedEMILoan.actualEMI) : '',
          }}
          onSave={handleSaveEMI}
          onDelete={handleDeleteEMI}
          onClose={() => { setEditingEMILoan(false); setSelectedEMILoan(null); }}
        />
      )}

      {selectedEMILoan && showPrepaymentForm && (
        <EMIPrepaymentForm
          loanName={selectedEMILoan.name}
          outstandingBalance={selectedEMILoan.emiStatus?.outstandingBalance}
          initial={editingPrepayment}
          isEditing={!!editingPrepayment}
          onSave={handleSavePrepayment}
          onDelete={editingPrepayment ? handleDeletePrepayment : undefined}
          onClose={() => { setShowPrepaymentForm(false); setEditingPrepayment(null); }}
        />
      )}

      {/* ===== Hand Loan Modals ===== */}
      {showHandForm && !editingHandLoan && (
        <HandLoanForm direction={showHandForm} onSave={handleSaveHandLoan} onClose={() => setShowHandForm(null)} />
      )}

      {selectedHandLoan && !editingHandLoan && !showHandPaymentForm && !editingHandPayment && (
        <HandLoanDetail
          loan={selectedHandLoan}
          onRecordPayment={() => setShowHandPaymentForm(true)}
          onEditPayment={(p) => setEditingHandPayment(p)}
          onEdit={() => setEditingHandLoan(true)}
          onClose={() => setSelectedHandLoan(null)}
        />
      )}

      {selectedHandLoan && editingHandLoan && (
        <HandLoanForm
          initial={{
            name: selectedHandLoan.name,
            principal: String(selectedHandLoan.principal),
            annualRate: String(selectedHandLoan.annualRate),
            startDate: selectedHandLoan.startDate,
            direction: selectedHandLoan.direction,
            debitsFrom: selectedHandLoan.debitsFrom,
            status: selectedHandLoan.status,
            notes: selectedHandLoan.notes,
          }}
          onSave={handleSaveHandLoan}
          onDelete={handleDeleteHandLoan}
          onClose={() => { setEditingHandLoan(false); setSelectedHandLoan(null); }}
        />
      )}

      {selectedHandLoan && showHandPaymentForm && (
        <HandLoanPaymentForm
          loan={selectedHandLoan}
          onSave={handleRecordHandPayment}
          onClose={() => setShowHandPaymentForm(false)}
        />
      )}

      {selectedHandLoan && editingHandPayment && (
        <HandLoanPaymentForm
          loan={selectedHandLoan}
          initial={editingHandPayment}
          isEditing
          onSave={handleEditHandPayment}
          onDelete={handleDeleteHandPayment}
          onClose={() => setEditingHandPayment(null)}
        />
      )}

      {/* ===== Credit Card Modals ===== */}
      {showCardForm && !editingCard && (
        <CreditCardForm onSave={handleSaveCard} onClose={() => setShowCardForm(false)} />
      )}

      {selectedCard && !editingCard && !showBillForm && (
        <CreditCardDetail
          card={selectedCard}
          onEdit={() => setEditingCard(true)}
          onAddBill={() => { setEditingBill(null); setShowBillForm(true); }}
          onEditBill={(b) => { setEditingBill(b); setShowBillForm(true); }}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {selectedCard && editingCard && (
        <CreditCardForm
          initial={{
            name: selectedCard.name,
            creditLimit: String(selectedCard.creditLimit),
            interestRateMonthly: String(selectedCard.interestRateMonthly),
            debitsFrom: selectedCard.debitsFrom,
            status: selectedCard.status,
            notes: selectedCard.notes,
          }}
          onSave={handleSaveCard}
          onDelete={handleDeleteCard}
          onClose={() => { setEditingCard(false); setSelectedCard(null); }}
        />
      )}

      {selectedCard && showBillForm && (
        <CreditCardBillForm
          cardName={selectedCard.name}
          initial={editingBill}
          isEditing={!!editingBill}
          onSave={handleSaveBill}
          onDelete={editingBill ? handleDeleteBill : undefined}
          onClose={() => { setShowBillForm(false); setEditingBill(null); }}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
