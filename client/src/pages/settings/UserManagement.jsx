import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Users, UserPlus, Loader2, AlertCircle, Save, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const UserManagement = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);
    
    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('employee');
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/users');
            if (res.data.success) {
                setUsers(res.data.data);
            }
        } catch (err) {
            setError('Failed to load users.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setFormError('');
        setIsAdding(true);
        setEditingUserId(null);
        setName('');
        setEmail('');
        setPassword('');
        setRole('employee');
    };

    const handleOpenEdit = (user) => {
        setFormError('');
        setIsAdding(true);
        setEditingUserId(user.id);
        setName(user.name);
        setEmail(user.email);
        setPassword(''); // Keep empty, only change if typed
        setRole(user.role);
    };

    const handleCancel = () => {
        setIsAdding(false);
        setEditingUserId(null);
    };

    const handleSubmitUser = async (e) => {
        e.preventDefault();
        setFormError('');
        setIsSubmitting(true);

        try {
            if (editingUserId) {
                // Update
                const payload = { name, email, role };
                if (password) payload.password = password;
                
                const res = await api.put(`/users/${editingUserId}`, payload);
                if (res.data.success) {
                    handleCancel();
                    fetchUsers();
                }
            } else {
                // Create
                const res = await api.post('/users/create', { name, email, password, role });
                if (res.data.success) {
                    handleCancel();
                    fetchUsers();
                }
            }
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to save user');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (userId) => {
        if (window.confirm("Are you sure you want to delete this employee? This action cannot be undone.")) {
            try {
                const res = await api.delete(`/users/${userId}`);
                if (res.data.success) {
                    fetchUsers();
                }
            } catch (err) {
                alert(err.response?.data?.message || 'Failed to delete user');
            }
        }
    };

    return (
        <div className="bg-white border border-[#D9DDE5] rounded-[8px] overflow-hidden shadow-sm mt-6">
            <div className="px-6 py-4 border-b border-[#D9DDE5] bg-gray-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Users size={18} className="text-[#5A5DF6]" />
                    <h2 className="text-base font-bold text-[#1C2340]">User Management</h2>
                </div>
                <button
                    onClick={isAdding ? handleCancel : handleOpenAdd}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#5A5DF6] text-white rounded-[5px] text-sm font-medium hover:bg-[#4A4DD6] transition-colors"
                >
                    <UserPlus size={16} />
                    {isAdding ? 'Cancel' : 'Add Employee'}
                </button>
            </div>
            
            <div className="p-6">
                {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

                {/* Modal Overlay */}
                {isAdding && (
                    <div className="fixed inset-0 bg-[#1C2340]/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                            <div className="px-6 py-4 border-b border-[#D9DDE5] bg-gray-50 flex justify-between items-center">
                                <h3 className="text-base font-bold text-[#1C2340]">
                                    {editingUserId ? 'Edit User details' : 'Add New User'}
                                </h3>
                                <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                            
                            <form onSubmit={handleSubmitUser} className="p-6 space-y-4">
                                {formError && (
                                    <div className="bg-red-50 text-red-500 p-2 rounded text-xs flex items-center gap-1">
                                        <AlertCircle size={14} />
                                        {formError}
                                    </div>
                                )}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-[#1C2340] mb-1">Name</label>
                                        <input required value={name} onChange={e => setName(e.target.value)} type="text" className="w-full px-3 py-2 border border-[#D9DDE5] rounded text-sm focus:outline-none focus:border-[#5A5DF6]" placeholder="John Doe" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[#1C2340] mb-1">Email</label>
                                        <input required value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full px-3 py-2 border border-[#D9DDE5] rounded text-sm focus:outline-none focus:border-[#5A5DF6]" placeholder="john@example.com" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[#1C2340] mb-1">
                                            {editingUserId ? 'Set new Password' : 'Password'} {editingUserId && <span className="text-gray-400 font-normal">(Leave blank to keep unchanged)</span>}
                                        </label>
                                        <input required={!editingUserId} value={password} onChange={e => setPassword(e.target.value)} type="text" className="w-full px-3 py-2 border border-[#D9DDE5] rounded text-sm focus:outline-none focus:border-[#5A5DF6]" placeholder="••••••••" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[#1C2340] mb-1">Role</label>
                                        <select value={role} onChange={e => setRole(e.target.value)} className="w-full px-3 py-2 border border-[#D9DDE5] rounded text-sm focus:outline-none focus:border-[#5A5DF6]">
                                            <option value="employee">Employee</option>
                                            <option value="super_admin">Super Admin</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t border-[#D9DDE5] mt-6">
                                    <button type="button" onClick={handleCancel} className="px-4 py-2 border border-[#D9DDE5] text-[#1C2340] text-sm font-medium rounded hover:bg-gray-50">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-[#5A5DF6] text-white text-sm font-medium rounded flex items-center gap-2 hover:bg-[#4A4DD6]">
                                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        {editingUserId ? 'Update User' : 'Save User'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#5A5DF6]" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[#D9DDE5] text-xs font-semibold text-[#1C2340]/60 uppercase tracking-wider bg-gray-50">
                                    <th className="py-3 px-4">Name</th>
                                    <th className="py-3 px-4">Email</th>
                                    <th className="py-3 px-4">Role</th>
                                    <th className="py-3 px-4">Created At</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id} className="border-b border-[#D9DDE5]/50 hover:bg-gray-50/50">
                                        <td className="py-3 px-4 text-sm font-medium text-[#1C2340]">{u.name}</td>
                                        <td className="py-3 px-4 text-sm text-[#1C2340]/80">{u.email}</td>
                                        <td className="py-3 px-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${u.role === 'super_admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                                {u.role === 'super_admin' ? 'Admin' : 'Employee'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-[#1C2340]/60">
                                            {new Date(u.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenEdit(u)}
                                                    className="p-1.5 text-gray-500 hover:text-[#5A5DF6] hover:bg-[#5A5DF6]/10 rounded transition-colors"
                                                    title="Edit User"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(u.id)}
                                                    disabled={currentUser?.id === u.id}
                                                    className={`p-1.5 rounded transition-colors ${currentUser?.id === u.id ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-red-500 hover:bg-red-50'}`}
                                                    title={currentUser?.id === u.id ? 'Cannot delete yourself' : 'Delete User'}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagement;
