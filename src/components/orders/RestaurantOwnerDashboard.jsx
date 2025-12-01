// components/owner/RestaurantOwnerDashboard.jsx - FINAL FIXED VERSION
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../config/supabase';

// --- CONSTANTS ---
const ORANGE = '#FF8A00'; 
const NAVY = '#003366'; 
const LIGHT_BG = '#F7F7F7'; 
const GRAY_TEXT = '#6B7280'; 
const BORDER = '#D1D5DB';

// FIXED: Added 'Driver Assigned' to the list
const ORDER_STATUSES = ['Pending', 'Preparing', 'Driver Assigned', 'Out for Delivery', 'Delivered', 'Completed', 'Cancelled'];

// FIXED: Key used to save your filter selection in the browser
const STATUS_FILTER_KEY = 'restaurantOwnerStatusFilter'; 

const StyledInput = (props) => (
    <input 
        className="w-full p-3 border rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        style={{ borderColor: BORDER }}
        {...props} 
    />
);

const FoodButton = ({ children, onClick, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="w-full py-3 text-white rounded-lg font-bold transition duration-150 ease-in-out shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
        style={!disabled ? { backgroundColor: ORANGE } : {}}
    >
        {children}
    </button>
);

const Loading = () => (
    <div className="flex justify-center items-center min-h-screen">
        <p className="text-lg font-semibold" style={{ color: NAVY }}>Loading...</p>
    </div>
);

// ------------------------------------------------------------------
// --- OWNER AUTHENTICATION COMPONENT ---
// ------------------------------------------------------------------
const OwnerAuthPage = ({ onSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [ownerName, setOwnerName] = useState(''); 
    const [restaurantName, setRestaurantName] = useState('');
    const [addressStreet, setAddressStreet] = useState('');
    const [addressBarangay, setAddressBarangay] = useState('');
    const [restaurantCategoryId, setRestaurantCategoryId] = useState('');
    
    const [barangays, setBarangays] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            const { data: barangayData } = await supabase.from('delivery_zones').select('barangay_name');
            if (barangayData) setBarangays(barangayData);

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
                    const { error: ownerError } = await supabase
                        .from('owners')
                        .insert({
                            id: newUser.id,
                            contact_name: ownerName,
                        });
                    if (ownerError) throw new Error(`Failed to create owner profile: ${ownerError.message}`);
                    
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

                    await new Promise(resolve => setTimeout(resolve, 1000));
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
                                <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Your Full Name</label>
                                <StyledInput type="text" placeholder="e.g., Juan Dela Cruz" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Restaurant Name</label>
                                <StyledInput type="text" placeholder="e.g., Jollibee Tubod" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Barangay</label>
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
                                <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Category</label>
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
                        </>
                    )}
                   
                    <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Email</label>
                        <StyledInput type="email" placeholder="owner@business.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Password</label>
                        <StyledInput type="password" placeholder="******" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                </div>
                
                {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-600 font-medium">{error}</p></div>}
                {successMessage && <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg"><p className="text-sm text-green-600 font-medium">{successMessage}</p></div>}
                
                <div className='mt-6'>
                    <FoodButton onClick={handleAuth} disabled={loading}>{loading ? 'Processing...' : (isLogin ? 'Login' : 'Register & Create Restaurant')}</FoodButton>
                </div>
                
                <p className="mt-4 text-center text-sm" style={{ color: GRAY_TEXT }}>
                    {isLogin ? "New partner?" : "Existing user?"}
                    <button onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMessage(''); }} className="ml-2 font-bold hover:underline" style={{ color: ORANGE }} disabled={loading}>
                        {isLogin ? 'Register' : 'Login'}
                    </button>
                </p>
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
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [myRestaurant, setMyRestaurant] = useState(null);
    const [expandedOrder, setExpandedOrder] = useState(null);
    const [restaurantLoaded, setRestaurantLoaded] = useState(false);
    const [restaurantCheckAttempts, setRestaurantCheckAttempts] = useState(0);
    const [activeTab, setActiveTab] = useState('orders');
    const [products, setProducts] = useState([]);
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [productForm, setProductForm] = useState({
        name: '',
        price: '',
        stock: '',
        description: '',
        image_url: ''
    });

    // --- FIX STARTS HERE ---
    // 1. Initialize state from Local Storage
    const [statusFilter, setStatusFilter] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(STATUS_FILTER_KEY) || 'all';
        }
        return 'all';
    });

    // 2. Save to Local Storage whenever statusFilter changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(STATUS_FILTER_KEY, statusFilter);
        }
    }, [statusFilter]);
    // --- FIX ENDS HERE ---

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
            alert('Failed to update status. Check RLS policies on "orders".');
            console.error(error);
        }
    }, [orders]);

    const loadOrders = useCallback(async () => {
        if (!myRestaurant) return;
        setLoading(true);

        try {
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
            alert('Please fill in all required fields (Name, Price, Stock)');
            return;
        }

        try {
            const productData = {
                food_item_id: editingProduct?.food_item_id || `${myRestaurant.id}_${Date.now()}`,
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
            alert('Failed to save product: ' + error.message);
        }
    };

    const handleDeleteProduct = async (foodItemId) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            const { error } = await supabase.from('food_items').delete().eq('food_item_id', foodItemId);
            if (error) throw error;
            await loadProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Failed to delete product: ' + error.message);
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

    useEffect(() => {
        if (!user || restaurantLoaded) return; 
        
        let mounted = true; 
        let retryTimeout;

        const loadMyRestaurant = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase.from('restaurants').select('*').eq('owner_id', user.id).single(); 

                if (mounted) {
                    if (error && error.code === 'PGRST116') {
                        if (restaurantCheckAttempts < 3) {
                            console.log(`Restaurant not found, retrying... (attempt ${restaurantCheckAttempts + 1}/3)`);
                            setRestaurantCheckAttempts(prev => prev + 1);
                            retryTimeout = setTimeout(() => { setRestaurantLoaded(false); }, 2000);
                            return;
                        }
                    } else if (error) {
                        console.error('Error fetching restaurant:', error);
                    }
                    
                    setMyRestaurant(data || null);
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

        if (user) loadMyRestaurant();

        return () => { 
            mounted = false;
            if (retryTimeout) clearTimeout(retryTimeout);
        };
    }, [user, restaurantLoaded, restaurantCheckAttempts]); 

    useEffect(() => {
        if (myRestaurant) {
            loadOrders();
            loadProducts();
        }
    }, [myRestaurant, loadOrders, loadProducts]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setMyRestaurant(null);
        setOrders([]);
        setRestaurantLoaded(false);
        setRestaurantCheckAttempts(0);
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(order => statusFilter === 'all' || order.status === statusFilter);
    }, [orders, statusFilter]);
    
    // FIXED: Added all colors including Driver Assigned
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

    // FIXED: Updated flow
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
    if (!restaurantLoaded || (loading && !myRestaurant)) return <Loading />;

    if (!myRestaurant && restaurantLoaded) {
        return (
            <div className="min-h-screen flex items-center justify-center flex-col p-10" style={{ backgroundColor: LIGHT_BG }}>
                <div className="bg-white p-10 rounded-xl shadow-2xl text-center max-w-lg">
                    <span className="text-6xl mb-4 block">⚠️</span>
                    <h2 className="text-2xl font-bold mb-2" style={{ color: NAVY }}>No Restaurant Linked</h2>
                    <p className="mb-6 text-gray-600">Please logout and register again using the Owner Registration form.</p>
                    <button onClick={handleSignOut} className="px-6 py-3 rounded-lg font-bold text-white transition" style={{ backgroundColor: ORANGE }}>Logout & Try Again</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: LIGHT_BG }}>
            <header className="shadow-lg p-4 sticky top-0 z-20" style={{ backgroundColor: NAVY }}>
                <div className="max-w-7xl mx-auto flex justify-between items-center text-white">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black">👨‍🍳 {myRestaurant.name}</h1>
                        <p className="text-xs opacity-90">{myRestaurant.address_barangay}</p>
                    </div>
                    <button onClick={handleSignOut} className="px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-sm font-bold">Logout</button>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 md:px-6">
                <div className="flex gap-4 mt-6 border-b border-gray-200">
                    <button onClick={() => setActiveTab('orders')} className={`pb-3 px-4 font-bold transition ${activeTab === 'orders' ? 'border-b-2 text-orange-600' : 'text-gray-500'}`} style={activeTab === 'orders' ? { borderColor: ORANGE } : {}}>📋 Orders</button>
                    <button onClick={() => setActiveTab('products')} className={`pb-3 px-4 font-bold transition ${activeTab === 'products' ? 'border-b-2 text-orange-600' : 'text-gray-500'}`} style={activeTab === 'products' ? { borderColor: ORANGE } : {}}>🍔 Products</button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 md:p-6">
                {activeTab === 'orders' && (
                    <>
                        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm">
                            <h2 className="font-bold text-lg" style={{ color: NAVY }}>Orders Queue</h2>
                            <div className="flex gap-2">
                                <select 
                                    value={statusFilter} 
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="p-2 border rounded-lg bg-gray-50 text-sm font-semibold"
                                >
                                    <option value="all">All Orders</option>
                                    {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <button onClick={loadOrders} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200">🔄</button>
                            </div>
                        </div>

                        {loading ? <Loading /> : filteredOrders.length === 0 ? (
                           <div className="text-center py-20 opacity-50"><span className="text-5xl">📦</span><p className="mt-4 font-bold">No orders found.</p></div>
                        ) : (
                            <div className="space-y-4">
                                {filteredOrders.map(order => (
                                    <div key={order.id} className="bg-white rounded-xl shadow-md overflow-hidden border-l-4" style={{ borderLeftColor: order.status === 'Completed' || order.status === 'Delivered' ? '#10B981' : ORANGE }}>
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
                                                    <p className="font-bold text-lg" style={{ color: NAVY }}>₱{order.restaurant_subtotal}</p>
                                                    <p className="text-gray-500 text-xs uppercase font-bold tracking-wider mt-2">Delivery Address</p>
                                                    <p className="text-gray-600 truncate">{order.shipping_address}</p>
                                                </div>
                                            </div>

                                            <button onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)} className="w-full text-left bg-gray-50 p-3 rounded-lg flex justify-between items-center hover:bg-gray-100 transition">
                                                <span className="font-bold text-sm text-gray-700">View Items ({order.order_items.length})</span>
                                                <span className="text-gray-400">{expandedOrder === order.id ? '▲' : '▼'}</span>
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

                                            {order.status !== 'Completed' && order.status !== 'Cancelled' && (
                                                <div className="mt-5 flex gap-3">
                                                    {getNextStatus(order.status) && (
                                                        <button onClick={() => updateOrderStatus(order.id, getNextStatus(order.status))} className="flex-1 py-3 text-white rounded-lg font-bold hover:opacity-90 transition shadow-lg" style={{ backgroundColor: ORANGE }}>
                                                            Mark as {getNextStatus(order.status)}
                                                        </button>
                                                    )}
                                                    {(order.status === 'Pending' || order.status === 'Preparing') && ( 
                                                        <button onClick={() => updateOrderStatus(order.id, 'Cancelled')} className="px-4 py-3 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200">Cancel Order</button>
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

                {activeTab === 'products' && (
                    <>
                        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm">
                            <h2 className="font-bold text-lg" style={{ color: NAVY }}>Menu Items</h2>
                            <button onClick={() => { setEditingProduct(null); setProductForm({ name: '', price: '', stock: '', description: '', image_url: '' }); setShowProductModal(true); }} className="px-4 py-2 text-white rounded-lg font-bold hover:opacity-90 transition" style={{ backgroundColor: ORANGE }}>+ Add Product</button>
                        </div>
                        {products.length === 0 ? (
                            <div className="text-center py-20 opacity-50"><span className="text-5xl">🍽️</span><p className="mt-4 font-bold">No products yet.</p></div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {products.map(product => (
                                    <div key={product.food_item_id} className="bg-white rounded-xl shadow-md overflow-hidden">
                                        {product.image_url && <img src={product.image_url} alt={product.name} className="w-full h-48 object-cover" />}
                                        <div className="p-4">
                                            <h3 className="font-bold text-lg mb-2">{product.name}</h3>
                                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
                                            <div className="flex justify-between items-center mb-4"><span className="font-bold text-xl" style={{ color: ORANGE }}>₱{product.price}</span><span className="text-sm text-gray-500">Stock: {product.stock}</span></div>
                                            <div className="flex gap-2">
                                                <button onClick={() => openEditProduct(product)} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold hover:bg-blue-100">Edit</button>
                                                <button onClick={() => handleDeleteProduct(product.food_item_id)} className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100">Delete</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {showProductModal && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                                <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                                    <h3 className="text-2xl font-bold mb-4" style={{ color: NAVY }}>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                                    <div className="space-y-3">
                                        <div><label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Product Name *</label><StyledInput type="text" placeholder="e.g., Chicken Adobo" value={productForm.name} onChange={(e) => setProductForm({...productForm, name: e.target.value})} /></div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Price (₱) *</label><StyledInput type="number" placeholder="99.00" value={productForm.price} onChange={(e) => setProductForm({...productForm, price: e.target.value})} /></div>
                                            <div><label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Stock *</label><StyledInput type="number" placeholder="50" value={productForm.stock} onChange={(e) => setProductForm({...productForm, stock: e.target.value})} /></div>
                                        </div>
                                        <div><label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Description</label><textarea className="w-full p-3 border rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500" style={{ borderColor: BORDER }} placeholder="Describe your dish..." rows="3" value={productForm.description} onChange={(e) => setProductForm({...productForm, description: e.target.value})} /></div>
                                        <div><label className="block text-xs font-bold mb-1" style={{ color: NAVY }}>Image URL</label><StyledInput type="text" placeholder="https://example.com/image.jpg" value={productForm.image_url} onChange={(e) => setProductForm({...productForm, image_url: e.target.value})} /></div>
                                    </div>
                                    <div className="flex gap-3 mt-6">
                                        <button onClick={() => { setShowProductModal(false); setEditingProduct(null); }} className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">Cancel</button>
                                        <button onClick={handleProductSubmit} className="flex-1 py-3 text-white rounded-lg font-bold hover:opacity-90 transition" style={{ backgroundColor: ORANGE }}>{editingProduct ? 'Update' : 'Add'} Product</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default RestaurantOwnerDashboard;    