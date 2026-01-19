import { useState, useRef, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Syphor Logo Component
const SyphorLogo = ({ className = "" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 5L35 12.5V27.5L20 35L5 27.5V12.5L20 5Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M20 12L27.5 15.75V24.25L20 28L12.5 24.25V15.75L20 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M20 19L22 21L20 23L18 21L20 19Z" fill="currentColor" />
    </svg>
);

const VerifyEmailPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email || 'user@example.com';
    const userId = location.state?.userId;

    const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const isComplete = code.every((digit) => digit !== '');

    const handleChange = (index: number, value: string) => {
        // Only allow single digit
        if (value.length > 1) {
            value = value.slice(-1);
        }

        // Only allow numbers
        if (value && !/^\d$/.test(value)) {
            return;
        }

        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 6);
        if (/^\d+$/.test(pastedData)) {
            const newCode = [...code];
            pastedData.split('').forEach((digit, i) => {
                if (i < 6) newCode[i] = digit;
            });
            setCode(newCode);
            // Focus last filled input or last input
            const lastIndex = Math.min(pastedData.length, 5);
            inputRefs.current[lastIndex]?.focus();
        }
    };

    const handleVerify = async () => {
        if (!isComplete) return;

        setIsLoading(true);

        // Temporarily bypass backend and navigate to business setup
        setTimeout(() => {
            setIsLoading(false);
            navigate('/signup/business');
        }, 500);
    };

    const handleResend = async () => {
        try {
            await fetch('http://localhost:5000/api/auth/resend-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            alert('Code resent successfully!');
        } catch (error) {
            console.error('Error resending code:', error);
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans">
            {/* Header */}
            <header className="w-full border-b border-gray-100 py-4 px-6 lg:px-12 flex justify-center lg:justify-start">
                <div className="flex items-center gap-2">
                    <SyphorLogo className="w-10 h-10 text-black" />
                    <span className="text-xl font-bold tracking-[0.2em] font-sans">SYPHØR</span>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center pt-24 px-6 md:px-0">
                <div className="w-full max-w-[480px]">
                    {/* Back Button */}
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-500 hover:text-black mb-12 transition-colors duration-200"
                    >
                        <ArrowLeft size={16} />
                        <span className="font-medium text-[15px]">Back</span>
                    </button>

                    {/* Title */}
                    <h1 className="text-[32px] font-bold text-gray-900 mb-4 tracking-tight">Verify your email address</h1>
                    <p className="text-[#6B7280] text-[17px] mb-12 leading-relaxed">
                        Enter the security code sent to<br />
                        <span className="text-gray-900 font-semibold">{email}</span> to proceed
                    </p>

                    {/* OTP Input */}
                    <div className="flex gap-2 sm:gap-4 mb-8 justify-center">
                        {code.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => { inputRefs.current[index] = el; }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={handlePaste}
                                className="w-[45px] sm:w-[60px] h-[54px] sm:h-[64px] text-center text-xl sm:text-2xl font-bold border border-gray-200 rounded-xl sm:rounded-2xl bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all duration-200"
                            />
                        ))}
                    </div>

                    {/* Resend */}
                    <p className="text-[#6B7280] text-[15px] mb-14">
                        Didn't get the code?{' '}
                        <button
                            onClick={handleResend}
                            className="text-gray-900 font-bold hover:underline"
                        >
                            Resend code
                        </button>
                    </p>

                    {/* Verify Button */}
                    <div className="flex justify-center">
                        <button
                            onClick={handleVerify}
                            disabled={!isComplete || isLoading}
                            className={`w-full max-w-[400px] py-4 rounded-2xl font-bold text-[17px] transition-all duration-300 ${isComplete
                                ? 'bg-black text-white hover:bg-gray-800 shadow-xl transform active:scale-[0.98]'
                                : 'bg-[#E5E5E5] text-[#A3A3A3] cursor-not-allowed'
                                }`}
                        >
                            {isLoading ? 'Verifying...' : 'Verify'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmailPage;
