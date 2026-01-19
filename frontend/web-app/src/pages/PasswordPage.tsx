import { useState } from 'react';
import { Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

// Syphor Logo Component
const SyphorLogo = ({ className = "" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 5L35 12.5V27.5L20 35L5 27.5V12.5L20 5Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M20 12L27.5 15.75V24.25L20 28L12.5 24.25V15.75L20 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M20 19L22 21L20 23L18 21L20 19Z" fill="currentColor" />
    </svg>
);

const PasswordPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const userId = location.state?.userId;

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

    const handleSubmit = async () => {
        if (!isValid || !isMatch) return;

        setIsLoading(true);
        try {
            // Mock API call to match the UI flow
            setTimeout(() => {
                navigate('/onboarding/business', { state: { userId } });
            }, 1000);

            /* 
            // Original logic for when backend is ready
            const response = await fetch('http://localhost:5000/api/auth/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, password }),
            });
            ...
            */
        } catch (error) {
            console.error('Error setting password:', error);
            alert('An error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans">
            {/* Header */}
            <header className="w-full border-b border-gray-100 py-4 px-6 lg:px-12 flex items-center justify-start">
                <div className="flex items-center gap-2">
                    <SyphorLogo className="w-8 h-8 text-black" />
                    <span className="text-xl font-bold tracking-[0.2em] font-sans">SYPHØR</span>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center pt-20 px-6 md:px-0">
                <div className="w-full max-w-[480px]">
                    {/* Back Button */}
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-500 hover:text-black mb-10 transition-colors duration-200"
                    >
                        <ArrowLeft size={16} />
                        <span className="font-medium text-[15px]">Back</span>
                    </button>

                    {/* Title */}
                    <h1 className="text-[32px] font-bold text-gray-900 mb-2 tracking-tight">Create your password</h1>
                    <p className="text-[#6B7280] text-[17px] mb-12">Choose a strong password.</p>

                    {/* Password Fields */}
                    <div className="space-y-6 mb-10">
                        <div>
                            <label className="block text-[15px] font-bold text-gray-900 mb-2">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all duration-200 pr-12 text-[17px]"
                                    placeholder="Enter your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={22} strokeWidth={1.5} /> : <Eye size={22} strokeWidth={1.5} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[15px] font-bold text-gray-900 mb-2">Confirm password</label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all duration-200 pr-12 text-[17px]"
                                    placeholder="Confirm your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff size={22} strokeWidth={1.5} /> : <Eye size={22} strokeWidth={1.5} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Validation List */}
                    <div className="space-y-4 mb-14">
                        {validations.map((v) => {
                            const isMet = v.regex.test(password);
                            return (
                                <div key={v.id} className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isMet
                                        ? 'bg-black border-black border-none'
                                        : 'border-gray-200 bg-white'
                                        }`}>
                                        <CheckCircle
                                            size={14}
                                            className={`${isMet ? 'text-white' : 'text-transparent'}`}
                                            strokeWidth={3}
                                        />
                                    </div>
                                    <span className={`text-[15px] transition-colors ${isMet ? 'text-gray-900 font-medium' : 'text-[#6B7280]'}`}>
                                        {v.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Continue Button */}
                    <div className="flex justify-center">
                        <button
                            onClick={handleSubmit}
                            disabled={!isValid || !isMatch || isLoading}
                            className={`w-full py-4 rounded-2xl font-bold text-[17px] transition-all duration-300 ${isValid && isMatch
                                ? 'bg-black text-white hover:bg-gray-800 shadow-xl transform active:scale-[0.98]'
                                : 'bg-[#E5E5E5] text-[#A3A3A3] cursor-not-allowed'
                                }`}
                        >
                            {isLoading ? 'Processing...' : 'Continue'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PasswordPage;
