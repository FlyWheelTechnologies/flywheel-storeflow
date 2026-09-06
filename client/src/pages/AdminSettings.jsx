import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabaseClient";
import "./Dashboard.css";

export default function AdminSettings() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('organization'); // 'organization' | 'staff'
  const [users, setUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'storekeeper', full_name: '' });
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const [editUserId, setEditUserId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Store & Tax Settings State
  const [orgForm, setOrgForm] = useState({
    name: '',
    phone: '',
    address: '',
    tin: '',
    is_vat_registered: false,
    default_tax_rate: 20.0,
    default_tax_inclusive: true
  });
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgLoaded, setOrgLoaded] = useState(false);

  useEffect(() => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') {
      fetchUsers();
      fetchOrg();
    }
  }, [currentUser]);

  const fetchUsers = async () => {
    const { data, error: fetchError } = await supabase.from('profiles').select('*');
    if (fetchError) {
      console.error("Error fetching users:", fetchError);
      setError("Permission denied or connection issue: " + fetchError.message);
    } else if (data) {
      setUsers(data);
    }
  };

  const fetchOrg = async () => {
    const orgId = currentUser?.organization_id;
    if (!orgId) return;
    try {
      const { data, error: fetchErr } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();
      if (fetchErr) throw fetchErr;
      if (data) {
        setOrgForm({
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
          tin: data.tin || '',
          is_vat_registered: !!data.is_vat_registered,
          default_tax_rate: data.default_tax_rate !== undefined ? data.default_tax_rate : 20.0,
          default_tax_inclusive: data.default_tax_inclusive !== undefined ? data.default_tax_inclusive : true
        });
        setOrgLoaded(true);
      }
    } catch (err) {
      console.warn("Could not load organization details:", err.message);
    }
  };

  const handleOrgSubmit = async (e) => {
    e.preventDefault();
    if (orgSaving) return;
    setOrgSaving(true);

    try {
      await supabase.auth.getSession();
      const orgId = currentUser?.organization_id;
      if (!orgId) throw new Error("No organization associated with this account.");

      const { error: updateErr } = await supabase
        .from('organizations')
        .update({
          name: orgForm.name,
          phone: orgForm.phone,
          address: orgForm.address,
          tin: orgForm.tin,
          is_vat_registered: orgForm.is_vat_registered,
          default_tax_rate: parseFloat(orgForm.default_tax_rate) || 0,
          default_tax_inclusive: !!orgForm.default_tax_inclusive,
          updated_at: new Date().toISOString()
        })
        .eq('id', orgId);

      if (updateErr) throw updateErr;

      setToast({ message: "Store & Tax settings updated successfully!", type: "success" });
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      console.error("Org update error:", err);
      setToast({ message: `Failed to update store settings: ${err.message}`, type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setOrgSaving(false);
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (!error) {
      fetchUsers();
      setToast({ message: "User removed successfully", type: "success" });
      setTimeout(() => setToast(null), 3000);
    } else {
      setError(error.message);
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');

    let submitError;

    try {
      if (editUserId) {
        const { error: updateError } = await supabase.from('profiles').update({
          full_name: newUser.full_name,
          role: newUser.role
        }).eq('id', editUserId);
        submitError = updateError;
      } else {
        try {
          const { data, error: functionError } = await supabase.functions.invoke('invite-user', {
            body: {
              email: newUser.email,
              password: newUser.password,
              role: newUser.role,
              full_name: newUser.full_name,
              organization_id: currentUser?.organization_id
            }
          });
          
          if (functionError || data?.error) {
            throw new Error(functionError?.message || data?.error || "Edge function unavailable");
          }
        } catch (fnErr) {
          console.warn("Edge function invite-user unconfigured, using Auth fallback:", fnErr.message);
          const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
            email: newUser.email,
            password: newUser.password,
            options: {
              data: {
                full_name: newUser.full_name,
                role: newUser.role,
                organization_id: currentUser?.organization_id
              }
            }
          });

          if (signUpErr && !signUpErr.message.includes("already registered")) {
            submitError = signUpErr;
          } else if (signUpData?.user) {
            await supabase.from('profiles').upsert({
              id: signUpData.user.id,
              email: newUser.email,
              full_name: newUser.full_name,
              role: newUser.role,
              organization_id: currentUser?.organization_id
            });
          }
        }
      }

      if (submitError) throw submitError;

      setShowAddUser(false);
      setNewUser({ email: '', password: '', role: 'storekeeper', full_name: '' });
      setEditUserId(null);
      fetchUsers();
      setToast({ message: editUserId ? "Staff account updated!" : "Staff account created!", type: "success" });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error("Error creating/editing user:", err);
      setError(err.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (user) => {
    setEditUserId(user.id);
    setNewUser({
      email: user.email,
      password: '',
      role: user.role,
      full_name: user.full_name || ''
    });
    setShowAddUser(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const ROLE_INFO = {
    storekeeper: { desc: 'Can process sales, add products, manage inventory and add customer deposits.', color: '#10b981', bg: '#ecfdf5' },
    auditor: { desc: 'Read-only access to sales, receipts, products, customers and journal entries.', color: '#3b82f6', bg: '#eff6ff' },
    admin: { desc: 'Full access to all modules, financial journals, staff management and store settings.', color: '#f59e0b', bg: '#fffbeb' },
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Toast Notification */}
      {toast && (
        <div 
          onClick={() => setToast(null)}
          style={{ 
            position:'fixed', top:24, left:'50%', transform:'translateX(-50%)', 
            background: toast.type === 'error' ? '#991b1b' : '#064e3b', 
            color:'#fff', padding:'14px 24px', borderRadius:'12px', 
            boxShadow:'0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1)', 
            zIndex:3000, display:'flex', alignItems:'center', gap:12, 
            animation:'slideDown 0.3s ease', cursor: 'pointer'
          }}
        >
          <span style={{ fontSize: 20 }}>{toast.type === 'error' ? '⚠️' : '✅'}</span>
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="section-title">Admin Settings</h2>
          <p style={{ color:'#6b7280', fontSize:13 }}>Manage store profile, tax configuration, and staff access</p>
        </div>
        {activeTab === 'staff' && (
          <button className="quick-action-btn" onClick={() => {
            setShowAddUser(!showAddUser);
            if (showAddUser) { setEditUserId(null); setNewUser({ email: '', password: '', role: 'storekeeper', full_name: '' }); }
          }}>
            {showAddUser ? 'Cancel' : '+ Add New Staff'}
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', border: '1px solid #fee2e2' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #e5e7eb', paddingBottom: 10 }}>
        <button
          onClick={() => setActiveTab('organization')}
          style={{
            background: activeTab === 'organization' ? '#f15a24' : '#f3f4f6',
            color: activeTab === 'organization' ? '#fff' : '#4b5563',
            border: 'none',
            padding: '8px 18px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🏢 Store & Tax Profile
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          style={{
            background: activeTab === 'staff' ? '#f15a24' : '#f3f4f6',
            color: activeTab === 'staff' ? '#fff' : '#4b5563',
            border: 'none',
            padding: '8px 18px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          👥 Staff & Roles ({users.length})
        </button>
      </div>

      {/* TAB 1: Store & Tax Profile */}
      {activeTab === 'organization' && (
        <div className="table-card" style={{ marginBottom: 24 }}>
          <div className="table-card__header">
            <h3 className="table-card__title">Store Details & Ghana Tax Profile</h3>
          </div>
          <form onSubmit={handleOrgSubmit} style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={lbl}>Business / Store Name *</label>
                <input style={inp} type="text" value={orgForm.name} onChange={e => setOrgForm({...orgForm, name: e.target.value})} required />
              </div>
              <div>
                <label style={lbl}>Contact Phone</label>
                <input style={inp} type="text" value={orgForm.phone} onChange={e => setOrgForm({...orgForm, phone: e.target.value})} placeholder="+233XXXXXXXXX" />
              </div>
              <div>
                <label style={lbl}>Physical Location / Address</label>
                <input style={inp} type="text" value={orgForm.address} onChange={e => setOrgForm({...orgForm, address: e.target.value})} placeholder="e.g. Accra Central, High Street" />
              </div>
              <div>
                <label style={lbl}>Ghana TIN / Ghana Card PIN</label>
                <input style={inp} type="text" value={orgForm.tin} onChange={e => setOrgForm({...orgForm, tin: e.target.value})} placeholder="e.g. C0012345678 or GHA-123456789-0" />
                <span style={{ fontSize: 11, color: '#6b7280', marginTop: 3, display: 'block' }}>Printed on official PDF and WhatsApp receipts</span>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
                🇬🇭 Ghana Revenue Authority (Act 1151) Tax Configuration
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                <div>
                  <label style={lbl}>VAT Registration Status</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                    <input 
                      type="checkbox" 
                      id="vat_registered"
                      checked={orgForm.is_vat_registered} 
                      onChange={e => setOrgForm({...orgForm, is_vat_registered: e.target.checked})}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <label htmlFor="vat_registered" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Registered for VAT (Turnover ≥ GHS 750,000)
                    </label>
                  </div>
                  <span style={{ fontSize: 11, color: '#6b7280', marginTop: 4, display: 'block' }}>
                    {orgForm.is_vat_registered 
                      ? '✓ Store charges standard 20% Unified Tax (15% VAT + 2.5% NHIL + 2.5% GETFund).'
                      : 'Non-VAT registered businesses charge 0% exempt rate.'}
                  </span>
                </div>

                <div>
                  <label style={lbl}>Default Tax Rate at Checkout</label>
                  <select 
                    style={inp} 
                    value={orgForm.default_tax_rate} 
                    onChange={e => setOrgForm({...orgForm, default_tax_rate: parseFloat(e.target.value)})}
                  >
                    <option value="20">20% Unified (15% VAT + 2.5% NHIL + 2.5% GETFund)</option>
                    <option value="15">15% Standard VAT Only</option>
                    <option value="0">0% Exempt / Zero-Rated</option>
                  </select>
                </div>

                <div>
                  <label style={lbl}>Default Price Mode</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                    <input 
                      type="checkbox" 
                      id="tax_inclusive"
                      checked={orgForm.default_tax_inclusive} 
                      onChange={e => setOrgForm({...orgForm, default_tax_inclusive: e.target.checked})}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <label htmlFor="tax_inclusive" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Selling prices are Tax-Inclusive by default
                    </label>
                  </div>
                  <span style={{ fontSize: 11, color: '#6b7280', marginTop: 4, display: 'block' }}>
                    When enabled, entered product prices already contain tax.
                  </span>
                </div>
              </div>
            </div>

            <button type="submit" className="quick-action-btn" style={{ height: 40, width: 'auto' }} disabled={orgSaving}>
              {orgSaving ? 'Saving Store Settings...' : 'Save Store & Tax Profile'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: Staff & Roles */}
      {activeTab === 'staff' && (
        <>
          {showAddUser && (
            <div className="table-card" style={{ marginBottom: 24 }}>
              <div className="table-card__header">
                <h3 className="table-card__title">{editUserId ? 'Update Staff Account' : 'Create New Staff Account'}</h3>
              </div>
              <form onSubmit={handleUserSubmit} style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <label style={lbl}>Full Name</label>
                  <input style={inp} type="text" value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name: e.target.value})} required />
                </div>
                <div>
                  <label style={lbl}>Email Address</label>
                  <input style={inp} type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required />
                </div>
                <div>
                  <label style={lbl}>{editUserId ? 'New Password (leave blank to keep current)' : 'Temporary Password'}</label>
                  <div style={{ position:'relative' }}>
                    <input 
                      style={inp} 
                      type={showPassword ? "text" : "password"} 
                      value={newUser.password} 
                      onChange={e => setNewUser({...newUser, password: e.target.value})} 
                      required={!editUserId} 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position:'absolute', right:8, top:8, background:'none', border:'none', fontSize:12, cursor:'pointer', color:'#6b7280' }}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={lbl}>Role</label>
                  <select style={inp} value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value="storekeeper">Storekeeper</option>
                    <option value="auditor">Auditor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" className="quick-action-btn" style={{ marginTop: 'auto', height: 38 }} disabled={saving}>
                  {saving ? 'Creating User...' : (editUserId ? 'Save Changes' : 'Create User')}
                </button>
              </form>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:16, marginBottom:24 }}>
            {Object.entries(ROLE_INFO).map(([role, info]) => (
              <div key={role} className="stat-card" style={{ borderTop:`3px solid ${info.color}` }}>
                <span style={{ fontWeight:700, fontSize:15, textTransform:'capitalize', color:info.color }}>{role}</span>
                <p style={{ fontSize:12, color:'#6b7280', marginTop:6 }}>{info.desc}</p>
              </div>
            ))}
          </div>

          <div className="table-card">
            <div className="table-card__header"><h3 className="table-card__title">System Users</h3></div>
            <div className="table-wrapper">
              <table className="stock-table">
                <thead><tr><th>Email</th><th>Full Name</th><th>Current Role</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{fontWeight:600}}>{u.email}</td>
                      <td>{u.full_name || '—'}</td>
                      <td>
                        <span style={{ background:ROLE_INFO[u.role]?.bg || '#f3f4f6', color:ROLE_INFO[u.role]?.color || '#374151', padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600 }}>{u.role}</span>
                      </td>
                      <td style={{ display:'flex', gap:10 }}>
                        <button 
                          onClick={() => startEdit(u)} 
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#2563eb', fontWeight:600, fontSize:13 }}
                        >
                          Edit
                        </button>
                        {u.id !== currentUser?.id && (
                          <button 
                            onClick={() => deleteUser(u.id)} 
                            style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontWeight:600, fontSize:13 }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const lbl = { display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 };
const inp = { width:'100%', padding:8, borderRadius:6, border:'1px solid #ddd', fontSize:13 };
