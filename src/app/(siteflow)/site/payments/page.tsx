import { Card, StatusBadge } from '@/core/ui';

export const metadata = { title: 'Pembayaran — SiteFlow' };

// Mock data
const PAYMENTS = [
  {
    id: 'inv-1',
    project: 'Rumah Bapak Andi',
    reference: 'Termin 1 - Pondasi',
    amount: 'Rp 25.000.000',
    status: 'paid',
    date: '24 Jul 2026',
  },
  {
    id: 'inv-2',
    project: 'Rumah Bapak Andi',
    reference: 'Termin 2 - Struktur Atas',
    amount: 'Rp 40.000.000',
    status: 'processing',
    date: 'Menunggu proses',
  }
];

export default function PaymentsPage() {
  return (
    <div className="space-y-4 pb-10">
      <header className="mb-4">
         <h1 className="text-xl font-bold text-[color:var(--color-ink)]">Status Pembayaran</h1>
         <p className="text-sm text-[color:var(--color-ink-secondary)]">Daftar tagihan Anda ke Arkavena.</p>
      </header>
      
      <div className="space-y-3">
        {PAYMENTS.map((payment) => (
          <Card key={payment.id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-xs font-bold text-[color:var(--color-ink-tertiary)] uppercase tracking-wider">{payment.project}</p>
                <h3 className="font-semibold text-[15px] text-[color:var(--color-ink)] mt-0.5">{payment.reference}</h3>
              </div>
              <StatusBadge tone={payment.status === 'paid' ? 'success' : 'warning'}>
                {payment.status === 'paid' ? 'Dibayar' : 'Diproses'}
              </StatusBadge>
            </div>
            
            <div className="flex justify-between items-end mt-4">
               <div>
                  <p className="text-xs text-[color:var(--color-ink-secondary)]">Tanggal Pencairan</p>
                  <p className="text-sm font-medium text-[color:var(--color-ink)]">{payment.date}</p>
               </div>
               <div className="text-right">
                  <p className="text-xs text-[color:var(--color-ink-secondary)]">Nominal</p>
                  <p className="text-[17px] font-bold text-[color:var(--color-ink)]">{payment.amount}</p>
               </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
