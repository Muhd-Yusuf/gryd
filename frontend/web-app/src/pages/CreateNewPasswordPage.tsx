import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, CheckCircle } from 'lucide-react';

// Syphor Logo Component
const SyphorLogo = ({ className = "" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2L36 12V28L20 38L4 28V12L20 2Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M20 8L28 13V23L20 28L12 23V13L20 8Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="20" cy="18" r="3" fill="currentColor" />
    </svg>
);

const CreateNewPasswordPage = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Validation Rules
    const validations = [
        { id: 1, label: '10 characters minimum', regex: /.{10,}/ },
        { id: 2, label: 'At least one lowercase character', regex: /[a-z]/ },
        { id: 3, label: 'At least one uppercase character', regex: /[A-Z]/ },
        { id: 4, label: 'At least one special character e.g !#$%&*+,.-/:;<=>?@\\^_|~', regex: /[!#$%&*+,.\-/:;<=>?@\\^_|~]/ },
        { id: 5, label: 'At least one number', regex: /[0-9]/ },
    ];

    const isValid = validations.every(v => v.regex.test(password));
    const isMatch = password === confirmPassword && password.length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid || !isMatch) return;

        setIsLoading(true);
        try {
            // Mock API call
            setTimeout(() => {
                setIsLoading(false);
                navigate('/dashboard');
            }, 1000);
        } catch (error) {
            console.error('Error creating password:', error);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FAFAFA] flex flex-col font-sans">
            {/* Header */}
            <header className="w-full bg-white border-b border-gray-100 py-4 px-6 lg:px-12 flex items-center justify-start">
                <div className="flex items-center gap-2">
                    <SyphorLogo className="w-8 h-8 text-black" />
                    <span className="text-xl font-bold tracking-[0.2em]">SYPHØR</span>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center pt-20 px-6">
                <div className="w-full max-w-md animate-[fadeIn_0.4s_ease-out]">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-500 hover:text-black mb-10 transition-colors"
                    >
                        <ArrowLeft size={16} />
                        <span className="font-bold text-[15px]">Back</span>
                    </button>

                    <h1 className="text-[32px] font-bold text-gray-900 mb-2">Create new password</h1>
                    <p className="text-gray-500 text-[17px] mb-12">Choose a strong password.</p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white focus:border-black focus:ring-0 outline-none transition-all placeholder:text-gray-400 pr-12"
                                    placeholder="Enter your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Confirm password</label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white focus:border-black focus:ring-0 outline-none transition-all placeholder:text-gray-400 pr-12"
                                    placeholder="Confirm your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Validation List */}
                        <div className="space-y-3 pt-2">
                            {validations.map((v) => {
                                const isMet = v.regex.test(password);
                                return (
                                    <div key={v.id} className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${isMet ? 'bg-black' : 'border border-gray-200'
                                            }`}>
                                            <CheckCircle size={14} className={isMet ? 'text-white' : 'text-transparent'} />
                                        </div>
                                        <span className={`text-sm ${isMet ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                                            {v.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            type="submit"
                            disabled={!isValid || !isMatch || isLoading}
                            className={`w-full py-4 rounded-full font-bold text-[17px] transition-all mt-8 ${!isValid || !isMatch || isLoading
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-black text-white hover:bg-gray-800 shadow-lg'
                                }`}
                        >
                            {isLoading ? 'Processing...' : 'Continue'}
                        </button>
                    </form>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default CreateNewPasswordPage;
