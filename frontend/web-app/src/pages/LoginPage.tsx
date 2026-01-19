import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, User, Calendar, Users, Eye, EyeOff } from 'lucide-react';

// Syphor Logo Component
const SyphorLogo = ({ className = "" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2L36 12V28L20 38L4 28V12L20 2Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M20 8L28 13V23L20 28L12 23V13L20 8Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="20" cy="18" r="3" fill="currentColor" />
    </svg>
);

const LoginPage = () => {
    const navigate = useNavigate();
    const [activeSlide, setActiveSlide] = useState(0);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Auto-rotate slides
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % 3);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // State for form
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    // Validation errors state
    const [errors, setErrors] = useState<{
        email?: string;
        password?: string;
        general?: string;
    }>({});

    // Email validation regex
    const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validateForm = (): boolean => {
        const newErrors: typeof errors = {};

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!isValidEmail(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
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

        try {
            // Mocking the backend response for now, to be connected when ready
            /*
            const response = await fetch('http://localhost:5000/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: formData.email.trim().toLowerCase(),
                    password: formData.password,
                }),
            });
            const data = await response.json();
            if (response.ok) {
                console.log('Login successful:', data);
                navigate('/dashboard');
            } else {
                setErrors({ general: data.message || 'Login failed. Please check your credentials.' });
            }
            */

            // For now, simulate successful login
            setTimeout(() => {
                setIsLoading(false);
                navigate('/dashboard');
            }, 1000);

        } catch (error) {
            console.error('Error logging in:', error);
            setErrors({ general: 'Unable to connect to server. Please check your connection and try again.' });
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-full overflow-hidden">
            {/* Left Side - Hero/Branding (Reused from Signup) */}
            <div className="hidden lg:flex w-1/2 bg-black text-white flex-col justify-between items-center relative p-12 overflow-hidden">
                <div className="w-full flex items-center gap-3 z-10">
                    <SyphorLogo className="w-10 h-10 text-white" />
                    <span className="text-xl font-bold tracking-widest">SYPHØR</span>
                </div>

                <div className="relative w-full flex-1 flex items-center justify-center">
                    <div
                        className="relative bg-white text-black p-6 rounded-3xl shadow-2xl w-80 transition-all duration-500 hover:scale-105 hover:shadow-[0_25px_60px_rgba(255,255,255,0.15)]"
                        style={{ animation: 'float 6s ease-in-out infinite' }}
                    >
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

                        <div
                            className="absolute -right-16 -top-4 bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3 transition-all duration-300 hover:scale-110"
                            style={{ animation: 'floatSmall 4s ease-in-out infinite 0.5s' }}
                        >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                <div className="w-6 h-6 border-2 border-gray-300 rounded-full"></div>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400">Qualified Leads</p>
                                <p className="font-bold text-sm text-green-600">+4.36%</p>
                            </div>
                        </div>

                        <div
                            className="absolute -right-8 bottom-4 bg-white p-4 rounded-2xl shadow-xl w-48 transition-all duration-300 hover:scale-105"
                            style={{ animation: 'floatSmall 5s ease-in-out infinite 1s' }}
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

                <div className="text-center max-w-lg z-10">
                    <h1 className="text-4xl font-bold mb-4 tracking-tight">Welcome to Syphor!</h1>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        Lorem ipsum dolor sit amet consectetur. Imperdiet urna turpis etiam cras.
                    </p>
                    <div className="flex gap-2 justify-center mt-8">
                        {[0, 1, 2].map((idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveSlide(idx)}
                                className={`h-1 rounded-full transition-all duration-300 ${activeSlide === idx ? 'w-8 bg-white' : 'w-2 bg-gray-600 hover:bg-gray-500'}`}
                            />
                        ))}
                    </div>
                </div>

                <style>{`
                    @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
                    @keyframes floatSmall { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
                `}</style>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 bg-[#FAFAFA] flex flex-col justify-center items-center p-8 relative">
                {/* Mobile Header Logo */}
                <div className="lg:hidden w-full flex flex-col items-center gap-2 mb-12">
                    <SyphorLogo className="w-12 h-12 text-black" />
                    <span className="text-xl font-bold tracking-widest">SYPHØR</span>
                </div>

                <div className="w-full max-w-sm mx-auto animate-[fadeIn_0.5s_ease-out]">
                    <h2 className="text-[32px] font-bold mb-2">Login</h2>
                    <p className="text-gray-500 mb-10">Enter your email address and password</p>

                    {/* General Error Message */}
                    {errors.general && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                            {errors.general}
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className={`w-full px-5 py-4 rounded-2xl border bg-white focus:ring-0 outline-none transition-all placeholder:text-gray-400 ${errors.email ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-black'
                                    }`}
                                placeholder="Enter your email address"
                            />
                            {errors.email && (
                                <p className="mt-1.5 text-sm text-red-500">{errors.email}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    className={`w-full px-5 py-4 rounded-2xl border bg-white focus:ring-0 outline-none transition-all placeholder:text-gray-400 pr-12 ${errors.password ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-black'
                                        }`}
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
                            {errors.password && (
                                <p className="mt-1.5 text-sm text-red-500">{errors.password}</p>
                            )}
                            <div className="mt-4">
                                <Link to="/forgot-password" className="text-gray-500 text-sm font-medium hover:text-black transition-colors underline">
                                    Forgot password?
                                </Link>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full rounded-2xl py-4 font-bold text-lg transition-all duration-200 ${isLoading
                                ? 'bg-gray-400 text-white cursor-wait'
                                : 'bg-black text-white hover:bg-gray-800 shadow-lg'
                                }`}
                        >
                            {isLoading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>

                    <p className="mt-10 text-center text-gray-500">
                        Don't have an account? <Link to="/signup" className="text-black font-bold hover:underline">Create Account</Link>
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default LoginPage;
