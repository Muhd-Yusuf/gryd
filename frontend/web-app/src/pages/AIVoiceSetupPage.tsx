import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Mic, Pause, Square, Check, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AIVoiceSetupPage = () => {
    const navigate = useNavigate();

    // States: 'initial' | 'recording' | 'preview' | 'processing'
    const [status, setStatus] = useState('initial');
    const [timer, setTimer] = useState(0);
    const [micEnabled, setMicEnabled] = useState(false);
    const intervalRef = useRef<number | null>(null);

    // Mock timer for recording
    useEffect(() => {
        if (status === 'recording') {
            intervalRef.current = window.setInterval(() => {
                setTimer((prev) => prev + 1);
            }, 1000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [status]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = () => {
        setTimer(0);
        setStatus('recording');
    };

    const stopRecording = () => {
        setStatus('preview');
    };

    const handleSubmit = () => {
        setStatus('processing');
        setTimeout(() => {
            navigate('/dashboard', { state: { showSuccessModal: true } });
        }, 1500);
    };

    // Stepper component
    const Stepper = () => (
        <div className="flex items-center gap-4 text-sm">
            {/* Sign Up - Completed */}
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                </div>
                <span className="text-[#A3A3A3] font-bold">Sign Up</span>
            </div>

            <div className="w-12 h-px bg-gray-200"></div>

            {/* Business Setup - Completed */}
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                </div>
                <span className="text-[#A3A3A3] font-bold">Business Setup</span>
            </div>

            <div className="w-12 h-px bg-gray-200"></div>

            {/* AI Voice Setup - Active */}
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border-2 border-gray-900 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-black" />
                </div>
                <span className="text-gray-900 font-bold">AI Voice Setup</span>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col bg-white">
            {/* Header */}
            <header className="w-full py-4 px-6 lg:px-12 flex items-center justify-between border-b border-gray-100 bg-white flex-wrap gap-4">
                <Stepper />
                <button className="flex items-center gap-2 border-2 border-gray-900 rounded-xl px-4 py-2 text-[14px] font-bold hover:bg-gray-50 transition-colors">
                    <LogOut size={16} />
                    <span>Logout</span>
                </button>
            </header>

            <div className="flex-1 flex flex-col pt-12 px-6 lg:px-32 bg-[#FAFAFA]">
                <div className="max-w-4xl">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-500 hover:text-black mb-10 transition-colors"
                    >
                        <ArrowLeft size={16} />
                        <span className="font-bold text-[15px]">Back</span>
                    </button>

                    <h1 className="text-[28px] sm:text-[36px] font-bold text-gray-900 mb-2 tracking-tight">Clone AI Voice Assistant</h1>
                    <p className="text-[#6B7280] text-[16px] sm:text-[18px] mb-8 sm:mb-16">Set how you want your AI Assistant to sound</p>

                    {/* Recording Area */}
                    <div className="w-full border-2 border-dashed border-gray-200 rounded-[30px] sm:rounded-[40px] p-8 sm:p-20 flex flex-col items-center justify-center text-center bg-white min-h-[350px] sm:min-h-[400px] relative overflow-hidden transition-all duration-300">

                        {status === 'initial' && (
                            <div className="animate-[fadeIn_0.3s_ease-out] flex flex-col items-center">
                                <p className="text-[18px] font-bold text-gray-900 mb-12">Click to record a 30 seconds audio of your voice</p>
                                {!micEnabled ? (
                                    <button
                                        onClick={() => setMicEnabled(true)}
                                        className="bg-black text-white px-10 py-4 rounded-full font-bold flex items-center gap-3 hover:bg-gray-900 transition-all transform active:scale-[0.98]"
                                    >
                                        <Mic size={20} />
                                        <span>Record audio</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={startRecording}
                                        className="bg-black text-white px-10 py-4 rounded-full font-bold flex items-center gap-3 hover:bg-gray-900 transition-all transform active:scale-[0.98]"
                                    >
                                        <Mic size={20} />
                                        <span>Enable Microphone</span>
                                    </button>
                                )}
                            </div>
                        )}

                        {status === 'recording' && (
                            <div className="animate-[fadeIn_0.3s_ease-out] w-full max-w-2xl px-4">
                                <p className="text-left text-gray-900 font-bold mb-8 text-[17px]">Recording</p>

                                {/* Waveform Oval Background */}
                                <div className="w-full h-44 bg-[#F8F9FB] rounded-[100px] flex items-center justify-center mb-12 relative overflow-hidden">
                                    <div className="flex items-center justify-center gap-1.5 h-20 w-full px-12">
                                        {[...Array(50)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-1.5 bg-[#D1D5DB] rounded-full transition-all duration-150"
                                                style={{
                                                    height: Math.random() * 80 + 20 + '%',
                                                    animation: 'pulse 1.5s infinite ease-in-out',
                                                    animationDelay: `${i * 0.03}s`
                                                }}
                                            ></div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-[48px] font-mono font-bold tracking-tight text-gray-900">{formatTime(timer)}</span>
                                    <div className="flex items-center gap-4">
                                        <button className="px-8 py-3.5 bg-[#E5E7EB] text-gray-900 rounded-full font-bold flex items-center gap-2 hover:bg-gray-300 transition-colors">
                                            <Pause size={18} className="fill-current" />
                                            <span>Pause</span>
                                        </button>
                                        <button
                                            onClick={stopRecording}
                                            className="px-8 py-3.5 bg-[#FF4D4D] text-white rounded-full font-bold flex items-center gap-2 hover:bg-red-600 transition-colors"
                                        >
                                            <Square size={18} className="fill-current" />
                                            <span>Stop</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {status === 'preview' && (
                            <div className="animate-[fadeIn_0.3s_ease-out] w-full max-w-2xl px-4">
                                <p className="text-left text-gray-900 font-bold mb-8 text-[17px]">Preview</p>

                                {/* Waveform Oval Background with vertical needle */}
                                <div className="w-full h-44 bg-[#F8F9FB] rounded-[100px] flex items-center justify-center mb-12 relative overflow-hidden border border-gray-100 shadow-inner">
                                    {/* Playback Needle */}
                                    <div className="absolute w-[2px] h-32 bg-gray-900 left-1/2 z-10 rounded-full transform -translate-x-1/2">
                                        <div className="w-2.5 h-2.5 bg-gray-900 rounded-full absolute -top-1 -left-[4px]" />
                                    </div>

                                    <div className="flex gap-1.5 h-20 w-full justify-center px-12 items-center">
                                        {[...Array(60)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`w-1.5 rounded-full transition-all duration-300 ${i < 30 ? 'bg-gray-800' : 'bg-gray-300'}`}
                                                style={{ height: Math.random() * 60 + 20 + '%' }}
                                            ></div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-[48px] font-mono font-bold tracking-tight text-gray-900">{formatTime(timer)}</span>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => setStatus('initial')}
                                            className="px-10 py-3.5 bg-[#E5E7EB] text-gray-900 rounded-full font-bold hover:bg-gray-300 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSubmit}
                                            className="px-10 py-3.5 bg-black text-white rounded-full font-bold hover:bg-gray-900 transition-all transform active:scale-[0.98]"
                                        >
                                            Submit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {status === 'processing' && (
                            <div className="animate-[fadeIn_0.3s_ease-out] flex flex-col items-center">
                                <div className="w-16 h-16 border-4 border-gray-100 border-t-black rounded-full animate-spin mb-6"></div>
                                <p className="text-[#6B7280] font-medium text-[18px]">Processing your voice...</p>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse {
                    0%, 100% { transform: scaleY(1); opacity: 0.5; }
                    50% { transform: scaleY(1.3); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default AIVoiceSetupPage;
