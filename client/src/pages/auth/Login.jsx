import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Hexagon } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        const res = await login(email, password);
        if (res.success) {
            navigate('/upload');
        } else {
            setError(res.message);
        }
    };

    return (
        <div className="min-h-screen bg-[#F5F5FC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="flex items-center justify-center bg-[#5A5DF6] text-white w-12 h-12 rounded-lg shadow-md shadow-[#5A5DF6]/30">
                        <Hexagon size={28} fill="currentColor" />
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-[#1C2340]">
                    Sign in to Crasome
                </h2>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-[#EAEBF3]">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm text-center">
                                {error}
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-[#1C2340]">
                                Email address
                            </label>
                            <div className="mt-1">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2.5 border border-[#EAEBF3] rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#5A5DF6] focus:border-[#5A5DF6] sm:text-sm text-[#1C2340]"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#1C2340]">
                                Password
                            </label>
                            <div className="mt-1">
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2.5 border border-[#EAEBF3] rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#5A5DF6] focus:border-[#5A5DF6] sm:text-sm text-[#1C2340]"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#5A5DF6] hover:bg-[#4A4DD6] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5A5DF6] transition-colors"
                            >
                                Sign in
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
