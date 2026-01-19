import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, User, Calendar, Users } from 'lucide-react';

// Syphor Logo Component
const SyphorLogo = ({ className = "" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2L36 12V28L20 38L4 28V12L20 2Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M20 8L28 13V23L20 28L12 23V13L20 8Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="20" cy="18" r="3" fill="currentColor" />
    </svg>
);

const SignupPage = () => {
    const [step, setStep] = useState<'social' | 'email'>('social');
    const navigate = useNavigate();
    const [activeSlide, setActiveSlide] = useState(0);

    // Auto-rotate slides
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % 3);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // State for form
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
    });

    // Validation errors state
    const [errors, setErrors] = useState<{
        firstName?: string;
        lastName?: string;
        email?: string;
        general?: string;
    }>({});

    const [isLoading, setIsLoading] = useState(false);

    // Email validation regex
    const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validateForm = (): boolean => {
        const newErrors: typeof errors = {};

        if (!formData.firstName.trim()) {
            newErrors.firstName = 'First name is required';
        } else if (formData.firstName.trim().length < 2) {
            newErrors.firstName = 'First name must be at least 2 characters';
        }

        if (!formData.lastName.trim()) {
            newErrors.lastName = 'Last name is required';
        } else if (formData.lastName.trim().length < 2) {
            newErrors.lastName = 'Last name must be at least 2 characters';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!isValidEmail(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        // Clear error when user starts typing
        if (errors[name as keyof typeof errors]) {
            setErrors({ ...errors, [name]: undefined });
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        // Validate form before submission
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        setErrors({});

        // Temporarily bypass backend and navigate to verify email page
        setTimeout(() => {
            setIsLoading(false);
            navigate('/signup/verify', { state: { email: formData.email } });
        }, 500);
    };

    return (
        <div className="flex h-screen w-full overflow-hidden">
            {/* Left Side - Hero/Branding */}
            <div className="hidden lg:flex w-1/2 bg-black text-white flex-col justify-between items-center relative p-12 overflow-hidden">
                {/* Logo */}
                <div className="w-full flex items-center gap-3 z-10">
                    <SyphorLogo className="w-10 h-10 text-white" />
                    <span className="text-xl font-bold tracking-widest">SYPHØR</span>
                </div>

                {/* Floating Cards - Interactive Section */}
                <div className="relative w-full flex-1 flex items-center justify-center">
                    {/* Main Profile Card */}
                    <div
                        className="relative bg-white text-black p-6 rounded-3xl shadow-2xl w-80 transition-all duration-500 hover:scale-105 hover:shadow-[0_25px_60px_rgba(255,255,255,0.15)]"
                        style={{
                            animation: 'float 6s ease-in-out infinite',
                        }}
                    >
                        {/* Profile Header */}
                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-14 h-14 bg-gradient-to-br from-amber-200 to-orange-300 rounded-full overflow-hidden ring-2 ring-white shadow-lg">
                                <img
                                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie&backgroundColor=ffd5dc"
                                    alt="avatar"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div>
                                <h3 className="font-bold text-base">Charlie Nicole</h3>
                                <p className="text-xs text-gray-400">231-040572</p>
                            </div>
                        </div>

                        {/* User Details */}
                        <div className="space-y-3 mb-4">
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                    <Users size={14} className="text-gray-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400">231-040572</p>
                                    <p className="font-medium text-sm">Charlie Nicole</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                    <User size={14} className="text-gray-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400">Gender</p>
                                    <p className="font-medium text-sm">Female</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                    <Calendar size={14} className="text-gray-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400">231-040572</p>
                                    <p className="font-medium text-sm">01.02.2025</p>
                                </div>
                            </div>
                        </div>

                        {/* Floating Stats Card */}
                        <div
                            className="absolute -right-16 -top-4 bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3 transition-all duration-300 hover:scale-110"
                            style={{
                                animation: 'floatSmall 4s ease-in-out infinite 0.5s',
                            }}
                        >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                <div className="w-6 h-6 border-2 border-gray-300 rounded-full"></div>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400">Qualified Leads</p>
                                <p className="font-bold text-sm text-green-600">+4.36%</p>
                            </div>
                        </div>

                        {/* Community Badge Card */}
                        <div
                            className="absolute -right-8 bottom-4 bg-white p-4 rounded-2xl shadow-xl w-48 transition-all duration-300 hover:scale-105"
                            style={{
                                animation: 'floatSmall 5s ease-in-out infinite 1s',
                            }}
                        >
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-semibold">Community Badge</span>
                                <ArrowRight size={14} className="text-gray-400" />
                            </div>
                            <p className="text-[10px] text-gray-400 mb-2">March 5,2025</p>
                            <div className="flex items-center justify-between">
                                <span className="bg-gray-100 text-[10px] px-3 py-1 rounded-full font-medium">1 month</span>
                                <span className="text-2xl">🥉</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Content */}
                <div className="text-center max-w-lg z-10">
                    <h1 className="text-4xl font-bold mb-4 tracking-tight">Welcome to Syphor!</h1>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        Lorem ipsum dolor sit amet consectetur. Imperdiet urna turpis etiam cras.
                    </p>

                    {/* Pagination dots - Interactive */}
                    <div className="flex gap-2 justify-center mt-8">
                        {[0, 1, 2].map((idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveSlide(idx)}
                                className={`h-1 rounded-full transition-all duration-300 ${activeSlide === idx
                                    ? 'w-8 bg-white'
                                    : 'w-2 bg-gray-600 hover:bg-gray-500'
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                {/* CSS Animations */}
                <style>{`
                    @keyframes float {
                        0%, 100% { transform: translateY(0px); }
                        50% { transform: translateY(-15px); }
                    }
                    @keyframes floatSmall {
                        0%, 100% { transform: translateY(0px); }
                        50% { transform: translateY(-8px); }
                    }
                `}</style>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 bg-[#FAFAFA] flex flex-col justify-center items-center p-8 relative overflow-y-auto">
                {/* Mobile Header Logo */}
                <div className="lg:hidden w-full flex flex-col items-center gap-2 mb-12">
                    <SyphorLogo className="w-12 h-12 text-black" />
                    <span className="text-xl font-bold tracking-widest">SYPHØR</span>
                </div>

                <div className="w-full max-w-sm mx-auto">
                    {step === 'social' ? (
                        <div className="animate-[fadeIn_0.5s_ease-out]">
                            {/* Desktop Social Header - Hidden on mobile */}
                            <div className="hidden lg:flex justify-center mb-10">
                                <div className="flex items-center gap-2">
                                    <SyphorLogo className="w-10 h-10 text-black" />
                                    <span className="text-xl font-bold tracking-widest">SYPHØR</span>
                                </div>
                            </div>

                            <div className="text-center mb-8">
                                <h2 className="text-xl font-medium text-gray-700 leading-relaxed">
                                    Get better conversion in Real Estate Sales<br />with AI-powered System
                                </h2>
                            </div>

                            <div className="space-y-4">
                                <button className="w-full bg-white border border-gray-200 rounded-full py-3.5 flex items-center justify-center gap-3 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm">
                                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                                    <span className="font-medium text-gray-700">Sign up with Google</span>
                                </button>

                                <button className="w-full bg-white border border-gray-200 rounded-full py-3.5 flex items-center justify-center gap-3 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm">
                                    <img src="https://www.svgrepo.com/show/452062/microsoft.svg" className="w-5 h-5" alt="Microsoft" />
                                    <span className="font-medium text-gray-700">Sign up with Microsoft</span>
                                </button>
                            </div>

                            <div className="relative my-8">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-4 bg-[#FAFAFA] text-gray-400 font-medium">OR</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setStep('email')}
                                className="w-full bg-black text-white rounded-full py-3.5 font-medium hover:bg-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl"
                            >
                                Sign up with email
                            </button>

                            <p className="mt-8 text-center text-sm text-gray-500">
                                Already have an account? <a href="/login" className="text-black font-semibold hover:underline">Login</a>
                            </p>
                        </div>
                    ) : (
                        // Email Form Step
                        <div className="animate-[fadeIn_0.5s_ease-out]">
                            <h2 className="text-3xl font-bold mb-2">Join Syphor</h2>
                            <p className="text-gray-500 mb-8">Welcome, let's set up your free account</p>

                            {/* General Error Message */}
                            {errors.general && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                                    {errors.general}
                                </div>
                            )}

                            <form className="space-y-5" onSubmit={handleSubmit}>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-2">First Name</label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-3.5 rounded-xl border bg-white focus:ring-0 outline-none transition-all placeholder:text-gray-400 ${errors.firstName ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-black'
                                            }`}
                                        placeholder="John"
                                    />
                                    {errors.firstName && (
                                        <p className="mt-1.5 text-sm text-red-500">{errors.firstName}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-2">Last Name</label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-3.5 rounded-xl border bg-white focus:ring-0 outline-none transition-all placeholder:text-gray-400 ${errors.lastName ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-black'
                                            }`}
                                        placeholder="Enter your last name"
                                    />
                                    {errors.lastName && (
                                        <p className="mt-1.5 text-sm text-red-500">{errors.lastName}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-2">Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-3.5 rounded-xl border bg-white focus:ring-0 outline-none transition-all placeholder:text-gray-400 ${errors.email ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-black'
                                            }`}
                                        placeholder="Enter your email address"
                                    />
                                    {errors.email && (
                                        <p className="mt-1.5 text-sm text-red-500">{errors.email}</p>
                                    )}
                                </div>

                                <div className="text-xs text-center text-gray-500 px-4 pt-2">
                                    By clicking continue, you accept our <a href="#" className="underline hover:text-black">Terms of service</a> and <a href="#" className="underline hover:text-black">Privacy policy</a>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className={`w-full rounded-full py-3.5 font-medium transition-all duration-200 ${isLoading
                                        ? 'bg-gray-400 text-white cursor-wait'
                                        : 'bg-black text-white hover:bg-gray-800 shadow-lg hover:shadow-xl'
                                        }`}
                                >
                                    {isLoading ? 'Creating account...' : 'Continue'}
                                </button>
                            </form>

                            <p className="mt-8 text-center text-sm text-gray-500">
                                Already have an account? <a href="/login" className="text-black font-semibold hover:underline">Login</a>
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Global Styles */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default SignupPage;
