import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabaseClient";
import "./Dashboard.css";

export default function Logs() {
  const { user: currentUser, activeOrg } = useAuth();
  const orgId = activeOrg?.id || currentUser?.organization_id;
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetchLogs();
    
    // Real-time subscription for logs scoped to active organization
    const channel = supabase
      .channel('logs-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, (payload) => {
        if (!orgId || currentUser?.role === 'super_admin' || payload.new?.organization_id === orgId) {
          setLogs(prev => [payload.new, ...prev]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, currentUser]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (orgId && currentUser?.role !== 'super_admin') {
      query = query.eq('organization_id', orgId);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error("Error fetching logs:", error.message);
    } else if (data) {
      setLogs(data);
    }
    setLoading(false);
  };

  const getActionColor = (action) => {
    if (!action) return '#6b7280';
    if (action.includes('SALE') || action.includes('DEPOSIT')) return '#10b981';
    if (action.includes('PRODUCT')) return '#2563eb';
    if (action.includes('STOCK')) return '#f59e0b';
    if (action.includes('USER')) return '#8b5cf6';
    if (action.includes('DELETE') || action.includes('REMOVE')) return '#ef4444';
    if (action.includes('STORE') || action.includes('ORG')) return '#06b6d4';
    return '#6b7280';
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.user_email?.toLowerCase().includes(search.toLowerCase()) || 
                          log.details?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'ALL' || log.action?.startsWith(filter);
    return matchesSearch && matchesFilter;
  });

  if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'super_admin') {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 className="section-title">Access Restricted</h2>
        <p style={{ color: '#6b7280', marginTop: 8 }}>
          Only Store Administrators have permission to view system audit logs.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="logs-container" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div className="skeleton" style={{ width: 300, height: 40 }} />
          <div style={{ display:'flex', gap:10 }}>
            <div className="skeleton" style={{ width: 120, height: 38 }} />
            <div className="skeleton" style={{ width: 160, height: 38 }} />
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(i => (
            <div key={i} className="skeleton" style={{ height: 45, marginBottom: 12, width: '100%' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="section-title">System Audit Logs</h2>
          <p style={{ color: '#6b7280', fontSize: 13 }}>Tamper-proof trail of all system actions</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select 
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="ALL">All Actions</option>
            <option value="SALE">Sales & Deposits</option>
            <option value="PRODUCT">Products</option>
            <option value="STOCK">Stock Adjustments</option>
            <option value="USER">User Management</option>
            <option value="STORE">Store Profile & Tax</option>
          </select>
          <input 
            type="search" 
            placeholder="Search logs..." 
            className="table-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-card">
        <div className="table-wrapper">
          <table className="stock-table">
            <thead>
              <tr>
                <th style={{ width: 180 }}>Time</th>
                <th>User / Role</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: 40 }}>
                  <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                  <p style={{ marginTop: 10, color: '#6b7280' }}>Loading audit trail...</p>
                </td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No logs matching your criteria.</td></tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '12px', color: '#6b7280' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{log.user_email}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'capitalize' }}>{log.user_role}</div>
                    </td>
                    <td>
                      <span style={{ 
                        fontWeight: 700, 
                        fontSize: '10px', 
                        color: getActionColor(log.action),
                        backgroundColor: `${getActionColor(log.action)}15`,
                        border: `1px solid ${getActionColor(log.action)}30`,
                        padding: '3px 8px',
                        borderRadius: '12px',
                        display: 'inline-block'
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: '#374151' }}>{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
