import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- SUPABASE CLIENT INITIALIZATION (FIXED) ---
// In a single-file environment, we define the client directly.
// IMPORTANT: Replace these with your actual Supabase URL and anonymous key.
const supabaseUrl = 'YOUR_SUPABASE_URL'; 
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

// Check for environment variables, otherwise use placeholders (for local testing)
const getSupabaseClient = () => {
    // Check if running in a platform that provides configuration (like Canvas)
    if (typeof __supabase_config !== 'undefined') {
        const config = JSON.parse(__supabase_config);
        return createClient(config.supabaseUrl, config.supabaseKey);
    }
    // Fallback for local development/testing
    if (supabaseUrl === 'YOUR_SUPABASE_URL' || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
        console.warn("⚠️ Supabase credentials are placeholders. Please replace 'YOUR_SUPABASE_URL' and 'YOUR_SUPABASE_ANON_KEY' with your actual values for the app to work.");
    }
    return createClient(supabaseUrl, supabaseAnonKey);
};

const supabase = getSupabaseClient();

// --- CONSTANTS ---
const ORANGE = '#FF8A00'; 
const NAVY = '#003366';
const LIGHT_BG = '#F7F7F7'; 
const GRAY_TEXT = '#6B7280'; 
const BORDER = '#D1D5DB';
const ORDER_STATUSES = ['Pending', 'Preparing', 'Driver Assigned', 'Out for Delivery', 'Delivered', 'Completed', 'Cancelled'];
const STATUS_FILTER_KEY = 'restaurantOwnerStatusFilter';

// --- UTILITY COMPONENTS ---

const StyledInput = (props) => (
    <input 
        className="w-full p-3 border rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow" 
        style={{ borderColor: BORDER }}
        {...props} 
    />
);

const FoodButton = ({ children, onClick, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="w-full py-3 text-white rounded-lg font-bold transition duration-150 ease-in-out shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed transform active:scale-[0.99] active:shadow-sm"
        style={!disabled ? { backgroundColor: ORANGE } : {}}
    >
        {children}
    </button>
);

const Loading = () => (
    <div className="flex justify-center items-center min-h-screen">
        <div className="flex items-center space-x-2">
            <svg className="animate-spin h-5 w-5 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-lg font-semibold" style={{ color: NAVY }}>Loading...</p>
        </div>
    </div>
);

// --- AUTHENTICATION/REGISTRATION COMPONENT ---

const OwnerAuthPage = ({ onSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [ownerName, setOwnerName] = useState(''); 
    const [phoneNumber, setPhoneNumber] = useState('');
    const [restaurantName, setRestaurantName] = useState('');
    const [addressStreet, setAddressStreet] = useState('');
    const [addressBarangay, setAddressBarangay] = useState('');
    const [restaurantCategoryId, setRestaurantCategoryId] = useState('');
    const [restaurantImageUrl, setRestaurantImageUrl] = useState('');
    
    const [barangays, setBarangays] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            // NOTE: You must have a 'delivery_zones' table with a 'barangay_name' column
            const { data: barangayData } = await supabase.from('delivery_zones').select('barangay_name');
            if (barangayData) setBarangays(barangayData);

            // NOTE: You must have a 'categories' table with 'id' and 'name' columns
            const { data: categoryData } = await supabase.from('categories').select('id, name');
            if (categoryData) setCategories(categoryData);
        };
        fetchData();
    }, []);

    const handleAuth = async () => {
        setError('');
        setSuccessMessage('');
        setLoading(true);

        if (!email || !password) {
            setError('Please fill in both email and password.');
            setLoading(false);
            return;
        }

        if (!isLogin && (!ownerName || !restaurantName || !addressBarangay || !restaurantCategoryId)) {
            setError('Your Name, Restaurant Name, Barangay, and Category are required for registration.');
            setLoading(false);
            return;
        }
        
        try {
            let authResult;
            if (isLogin) {
                authResult = await supabase.auth.signInWithPassword({ email, password });
                if (authResult.error) throw authResult.error;
                
                await new Promise(resolve => setTimeout(resolve, 500));
                onSuccess(authResult.data.user);
            } else {
                authResult = await supabase.auth.signUp({ 
                    email, 
                    password,
                    options: { 
                        data: { user_type: 'restaurant_owner' },
                        emailRedirectTo: window.location.origin 
                    } 
                });
                if (authResult.error) throw authResult.error;
                
                const newUser = authResult.data.user;

                if (newUser && authResult.data.session) {
                    // 1. Create Owner Profile
                    const { error: ownerError } = await supabase
                        .from('owners')
                        .insert({
                            id: newUser.id,
                            contact_name: ownerName,
                            phone_number: phoneNumber || null,
                        });
                    if (ownerError) throw new Error(`Failed to create owner profile: ${ownerError.message}`);
                    
                    // 2. Create Restaurant Profile
                    let retries = 3;
                    let restaurantCreated = false;
                    while (retries > 0 && !restaurantCreated) {
                        const { error: dbError } = await supabase
                            .from('restaurants')
                            .insert({
                                name: restaurantName,
                                address_street: addressStreet,
                                address_barangay: addressBarangay,
                                category_id: restaurantCategoryId,
                                image_url: restaurantImageUrl || null,
                                owner_id: newUser.id,
                                is_open: true
                            });
                        if (!dbError) {
                            restaurantCreated = true;
                        } else if (retries > 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            retries--;
                        } else {
                            throw new Error(`Failed to register restaurant: ${dbError.message}`);
                        }
                    }

                    await new Promise(resolve => setTimeout(resolve, 1500));
                    const { data: verifyRestaurant, error: verifyError } = await supabase
                        .from('restaurants')
                        .select('id, name')
                        .eq('owner_id', newUser.id)
                        .single();

                    if (verifyError || !verifyRestaurant) {
                        throw new Error('Restaurant was created but could not be verified. Please try logging in again.');
                    }

                    setSuccessMessage(`✅ Success! Restaurant "${verifyRestaurant.name}" registered. Redirecting...`);
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    onSuccess(newUser);
                    
                } else if (authResult.data.session === null) {
                    setSuccessMessage('Account created! Please check your email to confirm before logging in.');
                    setTimeout(() => setIsLogin(true), 3000);
                }
            }
        } catch (e) {
            console.error(e);
            setError(e.message || 'Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex justify-center items-center py-10" style={{ backgroundColor: LIGHT_BG }}>
            <div className="p-6 md:p-10 bg-white rounded-2xl shadow-2xl mx-4 w-full max-w-md h-auto overflow-y-auto max-h-[90vh]">
                <div className="text-center mb-6">
                    <span className="text-6xl mb-4 block">🍽️</span>
                    <h2 className="text-3xl font-extrabold" style={{ color: ORANGE }}>
                        {isLogin ? 'Owner Login' : 'Register Restaurant'}
                    </h2>
                </div>
                
                <div className='space-y-3'>
                    {!isLogin && (
                        <>
                            <div>
                                <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Your Full Name *</label>
                                <StyledInput type="text" placeholder="e.g., Juan Dela Cruz" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Contact Phone Number</label>
                                <StyledInput type="tel" placeholder="09xxxxxxxxx" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
                            </div>
                            <div className='pt-2'>
                                <label className="block text-sm font-extrabold mb-1" style={{ color: NAVY }}>Restaurant Details</label>
                                <hr className='mb-2'/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Restaurant Name *</label>
                                <StyledInput 
                                    type="text" placeholder="e.g., Jollibee Tubod" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Barangay *</label>
                                    <select 
                                        className="w-full p-3 border rounded-lg bg-gray-50 text-sm"
                                        value={addressBarangay}
                                        onChange={(e) => setAddressBarangay(e.target.value)}
                                        style={{ borderColor: BORDER }}
                                    >
                                        <option value="">Select Zone</option>
                                        {barangays.map(b => (
                                            <option key={b.barangay_name} value={b.barangay_name}>{b.barangay_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Street</label>
                                    <StyledInput type="text" placeholder="Street/Bldg" value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Category *</label>
                                <select 
                                    className="w-full p-3 border rounded-lg bg-gray-50 text-sm"
                                    value={restaurantCategoryId}
                                    onChange={(e) => setRestaurantCategoryId(e.target.value)}
                                    style={{ borderColor: BORDER }}
                                >
                                    <option value="">Select Category</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Restaurant Image URL (Optional)</label>
                                <StyledInput 
                                    type="text" placeholder="https://placehold.co/1200x400/003366/ffffff?text=Restaurant+Logo" 
                                    value={restaurantImageUrl} 
                                    onChange={(e) => setRestaurantImageUrl(e.target.value)} 
                                />
                                {restaurantImageUrl && <img src={restaurantImageUrl} alt="Restaurant Preview" className="mt-3 w-full h-24 object-cover rounded-lg border border-gray-200" />}
                            </div>
                        </>
                    )}
                   
                    <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Email *</label>
                        <StyledInput type="email" placeholder="owner@business.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Password *</label>
                        <StyledInput type="password" placeholder="******" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                </div>
                
                {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-600 font-medium">{error}</p></div>}
                {successMessage && <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg"><p className="text-sm text-green-600 font-medium">{successMessage}</p></div>}
                
                <div className='mt-6'>
                    <FoodButton onClick={handleAuth} disabled={loading}>{loading ?
                        'Processing...' : (isLogin ? 'Login' : 'Register & Create Restaurant')}</FoodButton>
                </div>
                
                <p className="mt-4 text-center text-sm" style={{ color: GRAY_TEXT }}>
                    {isLogin ?
                        "New partner?" : "Existing user?"}
                    <button onClick={() => { setIsLogin(!isLogin);
                        setError(''); setSuccessMessage(''); }} className="ml-2 font-bold hover:underline" style={{ color: ORANGE }} disabled={loading}>
                        {isLogin ?
                            'Register' : 'Login'}
                    </button>
                </p>
            </div>
        </div>
    );
};

// ENHANCED: New Product Sidebar Component
const ProductSidebar = ({ productForm, setProductForm, handleProductSubmit, editingProduct, setShowProductModal }) => {
    const isUpdating = !!editingProduct;

    // Helper for easier form updates
    const updateForm = (key, value) => setProductForm(prev => ({ ...prev, [key]: value }));

    // Close on escape key press
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setShowProductModal(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [setShowProductModal]);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 transition-opacity duration-300">
            <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl p-6 transition-transform duration-300 transform translate-x-0 overflow-y-auto">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h3 className="text-2xl font-bold" style={{ color: NAVY }}>{isUpdating ? 'Edit Product' : 'Add New Product'}</h3>
                    <button onClick={() => setShowProductModal(false)} className="text-gray-500 hover:text-gray-800 transition">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Product Name *</label>
                        <StyledInput type="text" placeholder="e.g., Chicken Adobo" value={productForm.name} onChange={(e) => updateForm('name', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Price (₱) *</label>
                            <StyledInput type="number" placeholder="99.00" value={productForm.price} onChange={(e) => updateForm('price', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Stock *</label>
                            <StyledInput type="number" placeholder="50" value={productForm.stock} onChange={(e) => updateForm('stock', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Description</label>
                        <textarea 
                            className="w-full p-3 border rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow" 
                            style={{ borderColor: BORDER }} 
                            placeholder="Describe your dish..." 
                            rows="3" 
                            value={productForm.description} 
                            onChange={(e) => updateForm('description', e.target.value)} 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Image URL (Direct Link)</label>
                        <StyledInput type="text" placeholder="https://example.com/image.jpg" value={productForm.image_url} onChange={(e) => updateForm('image_url', e.target.value)} />
                        {productForm.image_url && <img src={productForm.image_url} alt="Preview" className="mt-3 w-full h-32 object-cover rounded-lg border border-gray-200" />}
                    </div>
                </div>

                <div className="flex gap-3 mt-8 sticky bottom-0 bg-white pt-4 border-t">
                    <button 
                        onClick={() => setShowProductModal(false)} 
                        className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleProductSubmit} 
                        className="flex-1 py-3 text-white rounded-lg font-bold hover:opacity-90 transition transform active:scale-[0.99]" 
                        style={{ backgroundColor: ORANGE }}
                    >
                        {isUpdating ? 'Update Product' : 'Add Product'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- NEW: Profile Sidebar Component ---
const ProfileSidebar = ({ owner, restaurant, categories, barangays, onClose, onUpdate, loading }) => {
    const [ownerForm, setOwnerForm] = useState({ contact_name: owner.contact_name, phone_number: owner.phone_number || '' });
    const [restaurantForm, setRestaurantForm] = useState({
        name: restaurant.name,
        address_street: restaurant.address_street || '',
        address_barangay: restaurant.address_barangay,
        category_id: restaurant.category_id,
        image_url: restaurant.image_url || '',
        is_open: restaurant.is_open
    });

    const handleUpdate = () => {
        onUpdate(ownerForm, restaurantForm);
    };

    // Close on escape key press
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 transition-opacity duration-300">
            <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl p-6 transition-transform duration-300 transform translate-x-0 overflow-y-auto">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h3 className="text-2xl font-bold" style={{ color: NAVY }}>Edit Profile & Restaurant</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Owner Details */}
                    <div>
                        <h4 className="font-bold text-lg mb-3" style={{ color: ORANGE }}>Personal Details</h4>
                        <div className='space-y-3'>
                            <div>
                                <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Your Full Name</label>
                                <StyledInput 
                                    type="text" 
                                    value={ownerForm.contact_name} 
                                    onChange={(e) => setOwnerForm(p => ({ ...p, contact_name: e.target.value }))} 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Phone Number</label>
                                <StyledInput 
                                    type="tel" 
                                    placeholder="09xxxxxxxxx"
                                    value={ownerForm.phone_number} 
                                    onChange={(e) => setOwnerForm(p => ({ ...p, phone_number: e.target.value }))} 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Restaurant Details */}
                    <div>
                        <h4 className="font-bold text-lg mb-3" style={{ color: ORANGE }}>Restaurant Details</h4>
                        <div className='space-y-3'>
                            <div>
                                <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Restaurant Name</label>
                                <StyledInput 
                                    type="text" 
                                    value={restaurantForm.name} 
                                    onChange={(e) => setRestaurantForm(p => ({ ...p, name: e.target.value }))} 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Category</label>
                                    <select 
                                        className="w-full p-3 border rounded-lg bg-gray-50 text-sm"
                                        value={restaurantForm.category_id}
                                        onChange={(e) => setRestaurantForm(p => ({ ...p, category_id: e.target.value }))}
                                        style={{ borderColor: BORDER }}
                                    >
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Barangay</label>
                                    <select 
                                        className="w-full p-3 border rounded-lg bg-gray-50 text-sm"
                                        value={restaurantForm.address_barangay}
                                        onChange={(e) => setRestaurantForm(p => ({ ...p, address_barangay: e.target.value }))}
                                        style={{ borderColor: BORDER }}
                                    >
                                        {barangays.map(b => (
                                            <option key={b.barangay_name} value={b.barangay_name}>{b.barangay_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Street Address</label>
                                <StyledInput 
                                    type="text" 
                                    placeholder="Street/Bldg"
                                    value={restaurantForm.address_street} 
                                    onChange={(e) => setRestaurantForm(p => ({ ...p, address_street: e.target.value }))} 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Restaurant Image URL</label>
                                <StyledInput 
                                    type="text" 
                                    placeholder="https://placehold.co/1200x400/003366/ffffff?text=Restaurant+Logo"
                                    value={restaurantForm.image_url} 
                                    onChange={(e) => setRestaurantForm(p => ({ ...p, image_url: e.target.value }))} 
                                />
                                {restaurantForm.image_url && <img src={restaurantForm.image_url} alt="Restaurant Preview" className="mt-3 w-full h-24 object-cover rounded-lg border border-gray-200" />}
                            </div>
                            <div className="flex items-center pt-2">
                                <input 
                                    type="checkbox" 
                                    id="is_open" 
                                    checked={restaurantForm.is_open} 
                                    onChange={(e) => setRestaurantForm(p => ({ ...p, is_open: e.target.checked }))} 
                                    className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                                    style={{ accentColor: ORANGE }}
                                />
                                <label htmlFor="is_open" className="ml-2 block text-sm font-medium text-gray-700">
                                    Restaurant is Open (Toggle availability)
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-8 sticky bottom-0 bg-white pt-4 border-t">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleUpdate} 
                        disabled={loading}
                        className="flex-1 py-3 text-white rounded-lg font-bold hover:opacity-90 transition transform active:scale-[0.99] disabled:bg-gray-400" 
                        style={{ backgroundColor: ORANGE }}
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};


// ------------------------------------------------------------------
// --- MAIN DASHBOARD COMPONENT ---
// ------------------------------------------------------------------
const RestaurantOwnerDashboard = () => {
    const [user, setUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    const [owner, setOwner] = useState(null); 
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [myRestaurant, setMyRestaurant] = useState(null);
    const [expandedOrder, setExpandedOrder] = useState(null);
    const [restaurantLoaded, setRestaurantLoaded] = useState(false);
    const [restaurantCheckAttempts, setRestaurantCheckAttempts] = useState(0);
    const [activeTab, setActiveTab] = useState('orders');
    const [products, setProducts] = useState([]);
    
    // Sidebars
    const [showProductModal, setShowProductModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    
    // Product Editing State
    const [editingProduct, setEditingProduct] = useState(null);
    const [productForm, setProductForm] = useState({
        name: '', price: '', stock: '', description: '', image_url: ''
    });

    // Data for Profile Sidebar Selects
    const [barangays, setBarangays] = useState([]);
    const [categories, setCategories] = useState([]);

    // 1. Initialize state from Local Storage
    const [statusFilter, setStatusFilter] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(STATUS_FILTER_KEY) || 'all';
        }
        return 'all';
    });

    // Load static data for dropdowns
    useEffect(() => {
        const fetchData = async () => {
            const { data: barangayData } = await supabase.from('delivery_zones').select('barangay_name');
            if (barangayData) setBarangays(barangayData);

            const { data: categoryData } = await supabase.from('categories').select('id, name');
            if (categoryData) setCategories(categoryData);
        };
        fetchData();
    }, []);

    // 2. Save to Local Storage whenever statusFilter changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(STATUS_FILTER_KEY, statusFilter);
        }
    }, [statusFilter]);

    // Auth check logic
    useEffect(() => {
        let mounted = true;
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (mounted) {
                setUser(session?.user ?? null);
                setAuthReady(true);
            }
        };
        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (mounted) {
                setUser(session?.user ?? null);
                setAuthReady(true);
                setRestaurantLoaded(false); 
                setRestaurantCheckAttempts(0);
            }
        });

        return () => { mounted = false; subscription?.unsubscribe(); };
    }, []);

    const updateOrderStatus = useCallback(async (orderId, newStatus) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId)
                .select(); 

            if (error) throw error;
            setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        } catch (error) {
            console.error('Failed to update status:', error);
            // Using a simple modal approach instead of alert()
            const message = `Failed to update status. Error: ${error.message}. Please check RLS policies on "orders".`;
            // In a real app, this would trigger a custom modal/toast.
            console.log(message);
        }
    }, [orders]);

    const loadOrders = useCallback(async () => {
        if (!myRestaurant) return;
        setLoading(true);

        try {
            // Fetch order items relevant to the current restaurant
            const { data: items, error: itemsError } = await supabase
                .from('order_items')
                .select(`
                    order_id,
                    name,
                    price,
                    quantity,
                    food_items!inner ( restaurant_id )
                `)
                .eq('food_items.restaurant_id', myRestaurant.id);

            if (itemsError) throw itemsError;

            const uniqueOrderIds = [...new Set(items.map(i => i.order_id))];

            if (uniqueOrderIds.length === 0) {
                setOrders([]);
                setLoading(false);
                return;
            }

            // Fetch order headers
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('*')
                .in('id', uniqueOrderIds)
                .order('created_at', { ascending: false });
            if (ordersError) throw ordersError;

            const fullOrders = ordersData.map(order => {
                const relevantItems = items
                    .filter(i => i.order_id === order.id)
                    .map(i => ({
                        food_item_id: i.food_item_id,
                        name: i.name,
                        price: i.price,
                        quantity: i.quantity
                    }));
         
                const restaurantSubtotal = relevantItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                
                return { 
                    ...order, 
                    order_items: relevantItems, 
                    restaurant_subtotal: restaurantSubtotal.toFixed(2) 
                };
            });
            setOrders(fullOrders);
        } catch (error) {
            console.error('Error loading orders:', error);
        } finally {
            setLoading(false);
        }
    }, [myRestaurant]);


    const loadProducts = useCallback(async () => {
        if (!myRestaurant) return;
        try {
            const { data, error } = await supabase.from('food_items').select('*').eq('restaurant_id', myRestaurant.id).order('name');
            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }, [myRestaurant]);

    const handleProductSubmit = async () => {
        if (!productForm.name || !productForm.price || !productForm.stock) {
            console.error('Please fill in all required fields (Name, Price, Stock)');
            return;
        }

        try {
            const productData = {
                // Ensure a unique ID, especially for new inserts
                food_item_id: editingProduct?.food_item_id ||
                    `${myRestaurant.id}_${Date.now()}`,
                name: productForm.name,
                price: parseFloat(productForm.price),
                stock: parseInt(productForm.stock),
                description: productForm.description,
                image_url: productForm.image_url,
                restaurant_id: myRestaurant.id
            };
            if (editingProduct) {
                const { error } = await supabase.from('food_items').update(productData).eq('food_item_id', editingProduct.food_item_id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('food_items').insert(productData);
                if (error) throw error;
            }
            await loadProducts();
            setShowProductModal(false);
            setEditingProduct(null);
            setProductForm({ name: '', price: '', stock: '', description: '', image_url: '' });
        } catch (error) {
            console.error('Error saving product:', error);
            // Using a simple modal approach instead of alert()
            console.log('Failed to save product: ' + error.message);
        }
    };

    const handleDeleteProduct = async (foodItemId) => {
        if (!window.confirm('Are you sure you want to delete this product?')) return;
        try {
            const { error } = await supabase.from('food_items').delete().eq('food_item_id', foodItemId);
            if (error) throw error;
            await loadProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            // Using a simple modal approach instead of alert()
            console.log('Failed to delete product: ' + error.message);
        }
    };

    const openEditProduct = (product) => {
        setEditingProduct(product);
        setProductForm({
            name: product.name,
            price: product.price.toString(),
            stock: product.stock.toString(),
            description: product.description || '',
            image_url: product.image_url || ''
        });
        setShowProductModal(true);
    }; 
    
    // Load my restaurant and owner information
    useEffect(() => {
        if (!user || restaurantLoaded) return; 
        
        let mounted = true; 
        let retryTimeout;

        const loadMyData = async () => {
            setLoading(true);
            try {
                // Fetch Owner details
                const { data: ownerData, error: ownerError } = await supabase.from('owners').select('*').eq('id', user.id).single();
                if (ownerError && ownerError.code !== 'PGRST116') throw ownerError;
                if (mounted) setOwner(ownerData);

                // Fetch Restaurant details
                const { data: restaurantData, error: restaurantError } = await supabase.from('restaurants').select('*').eq('owner_id', user.id).single(); 

                if (mounted) {
                    if (restaurantError && restaurantError.code === 'PGRST116') {
                        if (restaurantCheckAttempts < 3) {
                            console.log(`Restaurant not found, retrying... (attempt ${restaurantCheckAttempts + 1}/3)`);
                            setRestaurantCheckAttempts(prev => prev + 1);
                            retryTimeout = setTimeout(() => { setRestaurantLoaded(false); }, 2000);
                            return;
                        }
                    } else if (restaurantError) {
                        console.error('Error fetching restaurant:', restaurantError);
                    }
                    
                    setMyRestaurant(restaurantData || null);
                    setRestaurantLoaded(true); 
                }
            } catch (err) {
                if (mounted) {
                    console.error(err);
                    setMyRestaurant(null);
                    setRestaurantLoaded(true);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        if (user) loadMyData();
        return () => { 
            mounted = false;
            if (retryTimeout) clearTimeout(retryTimeout);
        };
    }, [user, restaurantLoaded, restaurantCheckAttempts]); 

    // Load data when restaurant is available
    useEffect(() => {
        if (myRestaurant) {
            loadOrders();
            loadProducts();
        }
    }, [myRestaurant, loadOrders, loadProducts]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setOwner(null);
        setMyRestaurant(null);
        setOrders([]);
        setRestaurantLoaded(false);
        setRestaurantCheckAttempts(0);
    };

    // Handle Profile Update Submission
    const handleProfileUpdate = async (ownerForm, restaurantForm) => {
        if (!ownerForm.contact_name || !restaurantForm.name || !restaurantForm.address_barangay || !restaurantForm.category_id) {
            console.error('Owner Name, Restaurant Name, Barangay, and Category are required.');
            return;
        }
        setIsUpdatingProfile(true);
        try {
            // Update Owner Table
            const { error: ownerError } = await supabase
                .from('owners')
                .update({ contact_name: ownerForm.contact_name, phone_number: ownerForm.phone_number || null })
                .eq('id', user.id);

            if (ownerError) throw ownerError;

            // Update Restaurant Table
            const { error: restaurantError } = await supabase
                .from('restaurants')
                .update({ 
                    name: restaurantForm.name,
                    address_street: restaurantForm.address_street || null,
                    address_barangay: restaurantForm.address_barangay,
                    category_id: restaurantForm.category_id,
                    image_url: restaurantForm.image_url || null,
                    is_open: restaurantForm.is_open,
                })
                .eq('owner_id', user.id);

            if (restaurantError) throw restaurantError;

            // Refetch data to update UI
            const { data: updatedOwner } = await supabase.from('owners').select('*').eq('id', user.id).single();
            const { data: updatedRestaurant } = await supabase.from('restaurants').select('*').eq('owner_id', user.id).single();
            
            setOwner(updatedOwner);
            setMyRestaurant(updatedRestaurant);
            setShowProfileModal(false);
            // Using a simple modal approach instead of alert()
            console.log('Profile and Restaurant details updated successfully!');

        } catch (error) {
            console.error('Error updating profile:', error);
            // Using a simple modal approach instead of alert()
            console.log('Failed to update profile: ' + error.message);
        } finally {
            setIsUpdatingProfile(false);
        }
    };


    const filteredOrders = useMemo(() => {
        return orders.filter(order => statusFilter === 'all' || order.status === statusFilter);
    }, [orders, statusFilter]);

    // Status Badge utility function
    const getStatusBadge = (status) => {
        let color = GRAY_TEXT;
        let bg = '#F3F4F6';
        if (status === 'Pending') { color = '#F59E0B'; bg = '#FEF3C7'; } // Orange
        if (status === 'Preparing') { color = NAVY; bg = '#E0F2F7'; } // Navy
        if (status === 'Driver Assigned' || status === 'Out for Delivery') { color = '#3B82F6'; bg = '#DBEAFE'; } // Blue
        if (status === 'Delivered' || status === 'Completed') { color = '#10B981'; bg = '#D1FAE5'; } // Green
        if (status === 'Cancelled') { color = '#EF4444'; bg = '#FEE2E2'; } // Red
        return <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ color, backgroundColor: bg }}>{status}</span>;
    };

    // Get next status for the update button
    const getNextStatus = (current) => {
        const nextStatuses = {
            'Pending': 'Preparing',
            'Preparing': 'Driver Assigned',
            'Driver Assigned': 'Out for Delivery',
            'Out for Delivery': 'Delivered', 
            'Delivered': 'Completed' 
        };
        return nextStatuses[current] || null;
    };

    if (!authReady) return <Loading />;
    if (!user) return <OwnerAuthPage onSuccess={setUser} />;
    // Check if both restaurant and owner data are loaded
    if (!restaurantLoaded || (loading && (!myRestaurant || !owner))) return <Loading />; 
    
    // Fallback if user is logged in but no restaurant is linked
    if (!myRestaurant && restaurantLoaded) {
        return (
            <div className="min-h-screen flex items-center justify-center flex-col p-10" style={{ backgroundColor: LIGHT_BG }}>
                <div className="bg-white p-10 rounded-xl shadow-2xl text-center max-w-lg">
                    <span className="text-6xl mb-4 block">⚠️</span>
                    <h2 className="text-2xl font-bold mb-2" style={{ color: NAVY }}>No Restaurant Linked</h2>
                    <p className="mb-6 text-gray-600">Please check your registration details. Restaurant data is missing or inaccessible.</p>
                    <button onClick={handleSignOut} className="px-6 py-3 rounded-lg font-bold text-white transition" style={{ backgroundColor: ORANGE }}>Logout & Try Again</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: LIGHT_BG }}>
            <header className="shadow-lg p-4 sticky top-0 z-20" style={{ backgroundColor: NAVY }}>
                <div className="max-w-7xl mx-auto flex justify-between items-center text-white">
                    <div className='flex items-center gap-3'>
                        {myRestaurant.image_url && (
                            <img 
                                src={myRestaurant.image_url} 
                                // Placeholder for broken image URLs
                                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100x100/333/fff?text=R+Logo'; }}
                                alt="Restaurant Logo" 
                                className="w-10 h-10 object-cover rounded-full border-2 border-white/50"
                            />
                        )}
                        <div>
                            <h1 className="text-xl md:text-2xl font-black">👨‍🍳 {myRestaurant.name}</h1>
                            <p className="text-xs opacity-90">{myRestaurant.address_barangay} | Status: {myRestaurant.is_open ? 'Open' : 'Closed'}</p>
                        </div>
                    </div>
                    <div className='flex items-center gap-3'>
                         <button onClick={() => setShowProfileModal(true)} className="px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-sm font-bold transition">
                            Edit Profile
                        </button>
                        <button onClick={handleSignOut} className="px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-sm font-bold transition">Logout</button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 md:px-6">
                <div className="flex gap-4 mt-6 border-b border-gray-200">
                    <button onClick={() => setActiveTab('orders')} className={`pb-3 px-4 font-bold transition ${activeTab === 'orders' ?
                        'border-b-2 text-orange-600' : 'text-gray-500 hover:text-navy-700'}`} style={activeTab === 'orders' ? { borderColor: ORANGE } : {}}>📋 Orders</button>
                    <button onClick={() => setActiveTab('products')} className={`pb-3 px-4 font-bold transition ${activeTab === 'products' ?
                        'border-b-2 text-orange-600' : 'text-gray-500 hover:text-navy-700'}`} style={activeTab === 'products' ? { borderColor: ORANGE } : {}}>🍔 Products</button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 md:p-6">
                {/* --- ORDERS TAB --- */}
                {activeTab === 'orders' && (
                    <>
                        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm">
                            <h2 className="font-bold text-lg" style={{ color: NAVY }}>Orders Queue</h2>
                            <div className="flex gap-2">
                                <select 
                                    value={statusFilter} 
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="p-2 border rounded-lg bg-gray-50 text-sm font-semibold hover:border-orange-300 transition"
                                >
                                    <option value="all">All Orders</option>
                                    {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <button onClick={loadOrders} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition">🔄</button>
                            </div>
                        </div>

                        {loading 
                            ? <Loading /> : filteredOrders.length === 0 ? (
                            <div className="text-center py-20 opacity-50"><span className="text-5xl">📦</span><p className="mt-4 font-bold">No orders found.</p></div>
                        ) : (
                            <div className="space-y-4">
                                {filteredOrders.map(order => (
                                    <div 
                                        key={order.id} 
                                        className="bg-white rounded-xl shadow-md overflow-hidden border-l-4 transition-all duration-300 hover:shadow-xl hover:scale-[1.005] cursor-pointer" 
                                        style={{ borderLeftColor: order.status === 'Completed' || order.status === 'Delivered' ? '#10B981' : ORANGE }}
                                        onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                    >
                                        <div className="p-5">
                                            <div className="flex justify-between items-start mb-4 pb-3 border-b border-gray-100">
                                                <div>
                                                    <h3 className="font-bold text-lg text-gray-800">Order ID: #{order.id.slice(0, 8)}</h3>
                                                    <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {new Date(order.created_at).toLocaleDateString()}</p>
                                                </div>
                                                {getStatusBadge(order.status)}
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
                                                <div>
                                                    <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Customer</p>
                                                    <p className="font-semibold">{order.contact_name}</p>
                                                    <p className="text-gray-600">{order.contact_phone}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Restaurant Total</p>
                                                    <p className="font-bold text-xl" style={{ color: NAVY }}>₱{order.restaurant_subtotal}</p>
                                                    <p className="text-gray-500 text-xs uppercase font-bold tracking-wider mt-2">Delivery Address</p>
                                                    <p className="text-gray-600 truncate">{order.shipping_address}</p>
                                                </div>
                                            </div>

                                            <button 
                                                onClick={(e) => {e.stopPropagation(); setExpandedOrder(expandedOrder === order.id ? null : order.id);}} 
                                                className="w-full text-left bg-gray-50 p-3 rounded-lg flex justify-between items-center hover:bg-gray-100 transition"
                                            >
                                                <span className="font-bold text-sm text-gray-700">View Items ({order.order_items.length})</span>
                                                <span className="text-gray-400">{expandedOrder === order.id ?
                                                    '▲' : '▼'}</span>
                                            </button>

                                            {expandedOrder === order.id && (
                                                <div className="mt-2 bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-100">
                                                    {order.order_items.map((item, idx) => (
                                                        <div key={item.food_item_id + idx} className="flex justify-between items-center text-sm">
                                                            <div className="flex items-center gap-2"><span className="bg-white px-2 py-0.5 rounded border font-bold text-xs">x{item.quantity}</span><span>{item.name}</span></div>
                                                            <span className="font-mono text-gray-600">₱{(item.price * item.quantity).toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            {order.status !== 'Completed' && order.status !== 'Cancelled' && (
                                                <div className="mt-5 flex gap-3">
                                                    {getNextStatus(order.status) && (
                                                        <button 
                                                            onClick={(e) => {e.stopPropagation(); updateOrderStatus(order.id, getNextStatus(order.status));}} 
                                                            className="flex-1 py-3 text-white rounded-lg font-bold hover:opacity-90 transition shadow-lg transform active:scale-[0.99]" 
                                                            style={{ backgroundColor: ORANGE }}>
                                                            Mark as {getNextStatus(order.status)}
                                                        </button>
                                                    )}
                                                    {(order.status === 'Pending' ||
                                                        order.status === 'Preparing') && ( 
                                                        <button 
                                                            onClick={(e) => {e.stopPropagation(); updateOrderStatus(order.id, 'Cancelled');}} 
                                                            className="px-4 py-3 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200 transition">
                                                            Cancel Order
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* --- PRODUCTS TAB --- */}
                {activeTab === 'products' && (
                    <>
                        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm">
                            <h2 className="font-bold text-lg" style={{ color: NAVY }}>Menu Items</h2>
                            <button onClick={() => { setEditingProduct(null);
                                setProductForm({ name: '', price: '', stock: '', description: '', image_url: '' }); setShowProductModal(true);
                            }} className="px-4 py-2 text-white rounded-lg font-bold hover:opacity-90 transition transform active:scale-[0.99]" style={{ backgroundColor: ORANGE }}>+ Add Product</button>
                        </div>
                        {products.length === 0 ?
                            (
                                <div className="text-center py-20 opacity-50"><span className="text-5xl">🍽️</span><p className="mt-4 font-bold">No products yet. Click 'Add Product' to start building your menu!</p></div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {products.map(product => (
                                        <div key={product.food_item_id} className="bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
                                            {/* Use placeholder image if no URL is provided */}
                                            <img 
                                                src={product.image_url || `https://placehold.co/600x400/FF8A00/ffffff?text=${product.name.substring(0, 10).replace(/ /g, '+')}`} 
                                                alt={product.name} 
                                                className="w-full h-48 object-cover object-center" 
                                            />
                                            <div className="p-4 relative">
                                                {/* Edit/Delete Buttons */}
                                                <div className="absolute top-4 right-4 flex gap-2">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); openEditProduct(product); }}
                                                        className="text-gray-500 hover:text-blue-500 transition p-2 bg-white/70 rounded-full shadow-md"
                                                        title="Edit Product"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L15.232 5.232z"></path></svg>
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.food_item_id); }}
                                                        className="text-gray-500 hover:text-red-500 transition p-2 bg-white/70 rounded-full shadow-md"
                                                        title="Delete Product"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                    </button>
                                                </div>

                                                <h3 className="font-extrabold text-xl mb-1">{product.name}</h3>
                                                <p className="text-gray-500 text-sm mb-3 line-clamp-2">{product.description || 'No description provided.'}</p>
                                                <div className="flex justify-between items-center mb-4 border-t pt-3">
                                                    <span className="font-bold text-2xl" style={{ color: ORANGE }}>₱{product.price}</span>
                                                    <span className={`text-sm font-semibold px-3 py-1 rounded ${product.stock > 10 ? 'bg-green-100 text-green-600' : product.stock > 0 ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>Stock: {product.stock}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    {/* Duplicating Edit/Delete as list buttons for visibility */}
                                                    <button onClick={() => openEditProduct(product)} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold hover:bg-blue-100 transition">Edit</button>
                                                    <button onClick={() => handleDeleteProduct(product.food_item_id)} className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100 transition">Delete</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                        {/* Slide-Out Sidebar for Product Management */}
                        {showProductModal && (
                            <ProductSidebar 
                                productForm={productForm}
                                setProductForm={setProductForm}
                                handleProductSubmit={handleProductSubmit}
                                editingProduct={editingProduct}
                                setShowProductModal={setShowProductModal}
                            />
                        )}
                    </>
                )}

                {/* --- PROFILE SLIDE BAR --- */}
                {showProfileModal && owner && myRestaurant && (
                    <ProfileSidebar 
                        owner={owner}
                        restaurant={myRestaurant}
                        categories={categories}
                        barangays={barangays}
                        onClose={() => setShowProfileModal(false)}
                        onUpdate={handleProfileUpdate}
                        loading={isUpdatingProfile}
                    />
                )}

            </div>
        </div>
    );
};

export default RestaurantOwnerDashboard;