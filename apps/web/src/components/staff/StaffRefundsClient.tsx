'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type RefundStatus = 'REQUESTED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REJECTED';
type Action = 'approve' | 'reject' | 'transfer' | 'verify' | 'demo-complete';

type Refund = {
  id: string;
  orderId: string;
  amount: number;
  status: RefundStatus;
  requestedAt: string;
  approvedAt?: string | null;
  bankTransactionRef?: string | null;
  evidenceUrl?: string | null;
  transferRecordedAt?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  demoReference?: string | null;
  demoCompletedAt?: string | null;
  demoBy?: string | null;
  order?: {
    id: string;
    customerName: string;
    customerPhone: string;
    totalAmount: number;
    status: string;
  };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const labels: Record<RefundStatus, string> = {
  REQUESTED: 'Chờ xét duyệt',
  PENDING: 'Đang xử lý',
  SUCCEEDED: 'Đã hoàn tiền thật',
  FAILED: 'Thất bại',
  REJECTED: 'Đã từ chối',
};

const colors: Record<RefundStatus, string> = {
  REQUESTED: '#a16207',
  PENDING: '#1d4ed8',
  SUCCEEDED: '#15803d',
  FAILED: '#b91c1c',
  REJECTED: '#6b7280',
};

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

function getToken(): string | null {
  return window.localStorage.getItem('token');
}

function errorText(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return `Yêu cầu thất bại (HTTP ${status}).`;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d6d3d1',
  borderRadius: 8,
  backgroundColor: '#fff',
  color: '#292524',
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 14px',
  border: '1px solid #d6d3d1',
  borderRadius: 8,
  backgroundColor: '#292524',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

export default function StaffRefundsClient() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [role, setRole] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [transactionRefs, setTransactionRefs] = useState<Record<string, string>>({});
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string>>({});

  const loadRefunds = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError('Bạn cần đăng nhập bằng tài khoản nhân viên hoặc quản lý.');
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/refunds`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(errorText(data, response.status));
      if (!Array.isArray(data)) throw new Error('Dữ liệu hoàn tiền không đúng định dạng.');
      setRefunds(data as Refund[]);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không kết nối được Backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRefunds();
    const token = getToken();
    if (!token) return;
    void fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data: { role?: string; user?: { role?: string } } | null) => {
        setRole(data?.role || data?.user?.role || '');
      })
      .catch(() => setRole(''));
  }, [loadRefunds]);

  async function performAction(refundId: string, action: Action, body?: Record<string, unknown>) {
    if (workingId) return;
    const token = getToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.');
      return;
    }

    if (action === 'verify' && !window.confirm(
      'Bạn đã đối chiếu giao dịch ngân hàng và xác minh tiền hoàn thật sự được chuyển thành công?',
    )) return;

    if (action === 'demo-complete' && !window.confirm(
      'Xác nhận chạy HOÀN TIỀN MÔ PHỎNG? Không chuyển tiền thật, không gọi API hoàn tiền SePay và KHÔNG hủy đơn hàng thật.',
    )) return;

    setWorkingId(refundId);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/refunds/${encodeURIComponent(refundId)}/${action}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body || {}),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(errorText(data, response.status));

      const notices: Record<Action, string> = {
        approve: 'Đã duyệt yêu cầu. Đang chờ xử lý hoàn tiền.',
        reject: 'Đã từ chối yêu cầu hoàn tiền.',
        transfer: 'Đã ghi nhận thông tin chuyển khoản. Chưa xác minh tiền hoàn.',
        verify: 'Quản lý đã xác minh hoàn tiền thật và hủy đơn.',
        'demo-complete': 'Đã hoàn thành mô phỏng. KHÔNG chuyển tiền và KHÔNG hủy đơn thật.',
      };
      await loadRefunds();
      setMessage(notices[action]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xử lý được yêu cầu.');
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#faf7f2', padding: '32px 18px', color: '#292524' }}>
      <div style={{ maxWidth: 1050, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 750 }}>Quản lý hoàn tiền</h1>
            <p style={{ color: '#78716c', marginTop: 6 }}>
              Hoàn tiền thủ công có xác minh hoặc kiểm thử mô phỏng Sandbox.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link href="/staff/orders" style={{ ...buttonStyle, textDecoration: 'none' }}>
              Quản lý đơn hàng
            </Link>
            <button type="button" style={buttonStyle} onClick={() => { setLoading(true); void loadRefunds(); }}>
              Làm mới
            </button>
          </div>
        </header>

        {message && <p role="status" style={{ padding: 14, borderRadius: 8, marginBottom: 16, background: '#dcfce7', color: '#166534' }}>{message}</p>}
        {error && <p role="alert" style={{ padding: 14, borderRadius: 8, marginBottom: 16, background: '#fee2e2', color: '#991b1b' }}>{error}</p>}
        {loading && <p>Đang tải yêu cầu hoàn tiền...</p>}
        {!loading && refunds.length === 0 && !error && <p>Chưa có yêu cầu hoàn tiền nào.</p>}

        <div style={{ display: 'grid', gap: 20 }}>
          {refunds.map((refund) => {
            const isWorking = workingId !== null;
            const simulated = Boolean(refund.demoCompletedAt);
            const hasTransfer = Boolean(refund.bankTransactionRef);
            const canStartDemo = (role === 'ADMIN' || role === 'BARISTA') &&
              (refund.status === 'REQUESTED' || refund.status === 'PENDING') &&
              !simulated && !hasTransfer && !refund.transferRecordedAt;

            return (
              <section key={refund.id} style={{ padding: 22, border: '1px solid #e7e5e4', background: '#fff', borderRadius: 14, boxShadow: '0 3px 12px #00000008' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700 }}>Đơn #{refund.orderId.slice(0, 12)}</h2>
                    <p style={{ marginTop: 6 }}>Khách hàng: {refund.order?.customerName || 'N/A'}</p>
                    <p style={{ color: '#78716c', fontSize: 13 }}>{refund.order?.customerPhone || ''}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: 22 }}>{money(refund.amount)}</strong>
                    <div style={{ marginTop: 8, fontWeight: 700, color: colors[refund.status] }}>
                      {labels[refund.status] || refund.status}
                    </div>
                  </div>
                </div>

                <p style={{ color: '#78716c', fontSize: 13 }}>Mã yêu cầu: {refund.id}</p>
                <p style={{ color: '#78716c', fontSize: 13, marginTop: 5 }}>
                  Ngày yêu cầu: {new Date(refund.requestedAt).toLocaleString('vi-VN')}
                </p>
                {refund.rejectionReason && <p style={{ marginTop: 12, color: '#b91c1c' }}>Lý do từ chối: {refund.rejectionReason}</p>}

                {simulated && (
                  <div style={{ marginTop: 20, padding: 16, border: '1px solid #fbbf24', borderRadius: 10, background: '#fffbeb' }}>
                    <h3 style={{ fontWeight: 750 }}>Đã hoàn tất mô phỏng Sandbox</h3>
                    <p style={{ marginTop: 8 }}>Số tiền mô phỏng: {money(refund.amount)}</p>
                    <p style={{ marginTop: 6, overflowWrap: 'anywhere' }}>Mã Demo: {refund.demoReference || 'Chưa có'}</p>
                    <p style={{ marginTop: 6 }}>Thời gian: {new Date(refund.demoCompletedAt!).toLocaleString('vi-VN')}</p>
                    <p style={{ marginTop: 10, fontWeight: 600 }}>
                      Không có tiền thật được chuyển. SePay không xác nhận hoàn tiền. Đơn hàng thật không bị hủy.
                    </p>
                    <p style={{ marginTop: 6, color: '#92400e', fontSize: 13 }}>
                      Trạng thái yêu cầu thật vẫn là {refund.status}.
                    </p>
                  </div>
                )}

                {refund.status === 'REQUESTED' && !simulated && (
                  <div style={{ display: 'grid', gap: 12, marginTop: 20, paddingTop: 18, borderTop: '1px solid #e7e5e4' }}>
                    <button type="button" style={{ ...buttonStyle, width: 'fit-content' }} disabled={isWorking} onClick={() => void performAction(refund.id, 'approve')}>
                      Duyệt yêu cầu
                    </button>
                    <label>
                      <span style={{ display: 'block', marginBottom: 6 }}>Lý do từ chối</span>
                      <input style={inputStyle} maxLength={500} placeholder="Nhập lý do từ chối" value={reasons[refund.id] || ''}
                        onChange={(event) => setReasons((prev) => ({ ...prev, [refund.id]: event.target.value }))} />
                    </label>
                    <button type="button" style={{ ...buttonStyle, background: '#b91c1c', width: 'fit-content' }}
                      disabled={isWorking || !reasons[refund.id]?.trim()}
                      onClick={() => void performAction(refund.id, 'reject', { reason: reasons[refund.id] })}>
                      Từ chối yêu cầu
                    </button>
                  </div>
                )}

                {refund.status === 'PENDING' && !hasTransfer && !simulated && (
                  <div style={{ display: 'grid', gap: 12, marginTop: 20, paddingTop: 18, borderTop: '1px solid #e7e5e4' }}>
                    <h3 style={{ fontWeight: 700 }}>Ghi nhận chuyển khoản hoàn tiền thật</h3>
                    <p style={{ color: '#78716c', fontSize: 14 }}>
                      Chỉ nhập mã và chứng từ sau khi đã chuyển khoản thực tế cho khách.
                    </p>
                    <label>
                      <span style={{ display: 'block', marginBottom: 6 }}>Mã giao dịch ngân hàng</span>
                      <input style={inputStyle} value={transactionRefs[refund.id] || ''} maxLength={150}
                        onChange={(event) => setTransactionRefs((prev) => ({ ...prev, [refund.id]: event.target.value }))}
                        placeholder="Mã giao dịch thực tế" />
                    </label>
                    <label>
                      <span style={{ display: 'block', marginBottom: 6 }}>Đường dẫn chứng từ</span>
                      <input style={inputStyle} type="url" value={evidenceUrls[refund.id] || ''}
                        onChange={(event) => setEvidenceUrls((prev) => ({ ...prev, [refund.id]: event.target.value }))}
                        placeholder="https://..." />
                    </label>
                    <button type="button" style={{ ...buttonStyle, width: 'fit-content' }}
                      disabled={isWorking || !transactionRefs[refund.id]?.trim() || !evidenceUrls[refund.id]?.trim()}
                      onClick={() => void performAction(refund.id, 'transfer', {
                        bankTransactionRef: transactionRefs[refund.id],
                        evidenceUrl: evidenceUrls[refund.id],
                      })}>
                      Lưu thông tin chuyển khoản thật
                    </button>
                  </div>
                )}

                {refund.bankTransactionRef && (
                  <div style={{ marginTop: 18 }}>
                    <p>Mã giao dịch hoàn tiền thật: <strong>{refund.bankTransactionRef}</strong></p>
                    {refund.evidenceUrl && (
                      <a href={refund.evidenceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>
                        Xem chứng từ chuyển khoản
                      </a>
                    )}
                  </div>
                )}

                {refund.status === 'PENDING' && hasTransfer && !simulated && (
                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #e7e5e4' }}>
                    <p style={{ marginBottom: 12 }}>Đã ghi nhận chuyển khoản. Cần quản lý đối chiếu chứng từ và lịch sử giao dịch ngân hàng.</p>
                    {role === 'ADMIN' ? (
                      <button type="button" style={{ ...buttonStyle, background: '#15803d' }} disabled={isWorking}
                        onClick={() => void performAction(refund.id, 'verify', { confirmed: true })}>
                        Xác minh đã hoàn tiền thật
                      </button>
                    ) : <p style={{ color: '#78716c' }}>Đang chờ tài khoản ADMIN xác minh.</p>}
                  </div>
                )}

                {canStartDemo && (
                  <div style={{ marginTop: 20, padding: 16, border: '1px dashed #d97706', borderRadius: 10, background: '#fffbeb' }}>
                    <h3 style={{ fontWeight: 700 }}>Hoàn tiền mô phỏng — SePay Sandbox</h3>
                    <p style={{ marginTop: 8, marginBottom: 14, fontSize: 14 }}>
                      Chỉ tạo mã kiểm thử trong BrewLite. Không cần mã giao dịch ngân hàng, không chuyển tiền thật và không thay đổi số dư SePay.
                    </p>
                    <button type="button" style={{ ...buttonStyle, background: '#92400e' }} disabled={isWorking}
                      onClick={() => void performAction(refund.id, 'demo-complete')}>
                      Hoàn tiền mô phỏng {money(refund.amount)}
                    </button>
                  </div>
                )}

                {refund.status === 'SUCCEEDED' && !simulated && (
                  <p style={{ marginTop: 18, color: '#15803d', fontWeight: 700 }}>
                    Đã xác minh hoàn tiền thủ công thật. Đơn hàng đã hủy.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
