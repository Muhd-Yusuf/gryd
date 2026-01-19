import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Syphor Logo Component
const SyphorLogo = ({ className = "" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2L36 12V28L20 38L4 28V12L20 2Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M20 8L28 13V23L20 28L12 23V13L20 8Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="20" cy="18" r="3" fill="currentColor" />
    </svg>
);

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            // Mock API call
            setTimeout(() => {
                setIsLoading(false);
                navigate('/reset-password/otp', { state: { email } });
            }, 1000);
        } catch (error) {
            console.error('Error sending reset link:', error);
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
                    {/* Back Button */}
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-500 hover:text-black mb-10 transition-colors"
                    >
                        <ArrowLeft size={16} />
                        <span className="font-bold text-[15px]">Back</span>
                    </button>

                    <h1 className="text-[32px] font-bold text-gray-900 mb-2">Let's get you back in</h1>
                    <p className="text-gray-500 text-[17px] mb-12">
                        Please enter your email address. You will receive a mail with password reset instructions
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-10">
                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Email address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white focus:border-black focus:ring-0 outline-none transition-all placeholder:text-gray-400"
                                placeholder="Enter your email address"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !email}
                            className={`w-full py-4 rounded-2xl font-bold text-[17px] transition-all ${!email || isLoading
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-black text-white hover:bg-gray-800 shadow-lg'
                                }`}
                        >
                            {isLoading ? 'Sending...' : 'Send Reset Link'}
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

export default ForgotPasswordPage;
