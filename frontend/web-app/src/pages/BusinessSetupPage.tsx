import { useState } from 'react';
import { Check, LogOut, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BusinessSetupPage = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);

    const [formData, setFormData] = useState({
        profession: '',
        propertyType: '',
        usage: ''
    });

    const handleSelect = (key: string, value: string) => {
        setFormData({ ...formData, [key]: value });
    };

    const nextStep = () => {
        if (step < 3) {
            setStep(step + 1);
        } else {
            navigate('/signup/ai-voice');
        }
    };

    interface SelectionOption {
        id: string;
        label: string;
    }

    const professions: SelectionOption[] = [
        { id: 'realtor', label: 'Realtor/Agent' },
        { id: 'mortgage_broker', label: 'Mortgage Broker' },
        { id: 'title_rep', label: 'Title Rep' }
    ];

    const propertyTypes: SelectionOption[] = [
        { id: 'residential', label: 'Residential' },
        { id: 'commercial', label: 'Commercial' },
        { id: 'luxury', label: 'Luxury property' }
    ];

    const usages: SelectionOption[] = [
        { id: 'independent', label: 'Independent Agent' },
        { id: 'team_lead', label: 'Team Lead' }
    ];

    const renderQuestion = () => {
        let question = '';
        let options: SelectionOption[] = [];
        let stateKey = '';
        let currentVal = '';

        switch (step) {
            case 1:
                question = "What's your Profession?";
                options = professions;
                stateKey = 'profession';
                currentVal = formData.profession;
                break;
            case 2:
                question = "What kind of property do you sell?";
                options = propertyTypes;
                stateKey = 'propertyType';
                currentVal = formData.propertyType;
                break;
            case 3:
                question = "How would you like to use Syphor?";
                options = usages;
                stateKey = 'usage';
                currentVal = formData.usage;
                break;
            default:
                return null;
        }

        return (
            <div className="animate-[fadeIn_0.3s_ease-out] w-full max-w-[540px]">
                <div className="flex items-center gap-2 mb-8 text-[17px]">
                    <span className="font-bold text-gray-900">Q{step}</span>
                    <span className="text-gray-900 font-bold">{question}</span>
                </div>

                <div className="space-y-4">
                    {options.map((opt, index) => {
                        const letter = String.fromCharCode(65 + index);
                        const isSelected = currentVal === opt.label;

                        return (
                            <button
                                key={opt.id}
                                onClick={() => handleSelect(stateKey, opt.label)}
                                className={`w-full flex items-center justify-between p-4 px-5 rounded-2xl border-2 transition-all duration-200 ${isSelected
                                    ? 'border-gray-900 bg-[#E5E5E5]'
                                    : 'border-gray-200 hover:border-gray-300 bg-[#E5E5E5]'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl font-bold text-[15px] transition-all ${isSelected
                                        ? 'bg-black text-white'
                                        : 'bg-white text-gray-900 border border-gray-100'
                                        }`}>
                                        {letter}
                                    </div>
                                    <span className="text-[17px] font-medium text-gray-700">{opt.label}</span>
                                </div>
                                {isSelected && <Check size={20} className="text-gray-900" />}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-12">
                    <button
                        onClick={nextStep}
                        disabled={!currentVal}
                        className={`px-12 py-4 rounded-2xl font-bold text-[17px] transition-all duration-200 ${currentVal
                            ? 'bg-black text-white hover:bg-gray-800 shadow-lg'
                            : 'bg-[#E5E5E5] text-[#A3A3A3] cursor-not-allowed'
                            }`}
                    >
                        {step === 3 ? 'Continue' : 'Next Question'}
                    </button>
                </div>
            </div>
        );
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

            {/* Business Setup - Active */}
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                </div>
                <span className="text-gray-900 font-bold">Business Setup</span>
            </div>

            <div className="w-12 h-px bg-gray-200"></div>

            {/* AI Voice Setup - Pending */}
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center">
                    <Check size={12} className="text-transparent" strokeWidth={3} />
                </div>
                <span className="text-[#A3A3A3] font-bold">AI Voice Setup</span>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen bg-white">
            {/* Left Side - Cityscape Image */}
            <div className="hidden lg:block w-[320px] relative overflow-hidden shrink-0">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage: `url('https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80')`,
                        filter: 'brightness(0.4)',
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
            </div>

            {/* Right Side - Content */}
            <div className="flex-1 bg-[#FAFAFA] flex flex-col">
                {/* Header */}
                <header className="w-full py-4 px-6 lg:px-12 flex items-center justify-between bg-white border-b border-gray-100 flex-wrap gap-4">
                    <Stepper />
                    <button className="flex items-center gap-2 border-2 border-gray-900 rounded-xl px-4 py-2 text-[14px] font-bold hover:bg-gray-50 transition-colors">
                        <LogOut size={16} />
                        <span>Logout</span>
                    </button>
                </header>

                {/* Main Content */}
                <div className="flex-1 flex flex-col pt-24 px-6 lg:px-32">
                    <div className="max-w-xl">
                        {/* Title Section */}
                        <h1 className="text-[36px] font-bold text-gray-900 mb-2 tracking-tight">Help us personalize your experience</h1>
                        <p className="text-[#6B7280] text-[18px] mb-16">Tell us a bit about yourself</p>

                        {renderQuestion()}
                    </div>
                </div>

                {/* Optional Arrows in corners (from image) */}
                <div className="fixed bottom-8 right-8 flex gap-1">
                    <button className="w-10 h-10 bg-[#262626] text-white flex items-center justify-center rounded-l-lg hover:bg-black transition-colors">
                        <ChevronUp size={20} />
                    </button>
                    <button className="w-10 h-10 bg-[#262626] text-white flex items-center justify-center rounded-r-lg hover:bg-black transition-colors border-l border-white/10">
                        <ChevronDown size={20} />
                    </button>
                </div>
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default BusinessSetupPage;
