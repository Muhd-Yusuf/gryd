import { useState, useRef, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Syphor Logo Component
const SyphorLogo = ({ className = "" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2L36 12V28L20 38L4 28V12L20 2Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M20 8L28 13V23L20 28L12 23V13L20 8Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="20" cy="18" r="3" fill="currentColor" />
    </svg>
);

const ResetPasswordOTPPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email || 'user@example.com';

    const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const isComplete = code.every((digit) => digit !== '');

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) value = value.slice(-1);
        if (value && !/^\d$/.test(value)) return;

        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);

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
            const lastIndex = Math.min(pastedData.length, 5);
            inputRefs.current[lastIndex]?.focus();
        }
    };

    const handleVerify = async () => {
        if (!isComplete) return;
        setIsLoading(true);
        try {
            // Mocking verification
            setTimeout(() => {
                setIsLoading(false);
                navigate('/reset-password/new', { state: { email } });
            }, 1000);
        } catch (error) {
            console.error('Error verifying:', error);
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

                    <h1 className="text-[32px] font-bold text-gray-900 mb-2">Reset Password</h1>
                    <p className="text-gray-500 text-[17px] mb-12 leading-relaxed">
                        Enter the security code sent to<br />
                        <span className="text-gray-900 font-bold">{email}</span> to proceed
                    </p>

                    <div className="flex gap-3 justify-center mb-8">
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
                                className="w-14 h-16 text-center text-2xl font-bold border border-gray-200 rounded-2xl bg-white focus:border-black focus:ring-0 outline-none transition-all shadow-sm"
                            />
                        ))}
                    </div>

                    <p className="text-center text-gray-500 text-[15px] mb-14">
                        Didn't get the code?{' '}
                        <button onClick={() => { }} className="text-black font-bold hover:underline">
                            Resend code
                        </button>
                    </p>

                    <button
                        onClick={handleVerify}
                        disabled={!isComplete || isLoading}
                        className={`w-full py-4 rounded-2xl font-bold text-[17px] transition-all flex items-center justify-center gap-2 ${!isComplete || isLoading
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-black text-white hover:bg-gray-800 shadow-lg'
                            }`}
                    >
                        {isLoading ? (
                            <>
                                <span>Verify</span>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            </>
                        ) : (
                            'Verify'
                        )}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default ResetPasswordOTPPage;
