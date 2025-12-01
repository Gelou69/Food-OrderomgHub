// App.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './config/supabase';
import { useSupabase } from './hooks/useSupabase';
import { ORANGE, LIGHT_BG, BORDER } from './config/constants';
import { Loading } from './components/common/Loading';
import { AuthPage } from './components/auth/AuthPage';
import { RestaurantListing } from './components/products/RestaurantListing';
import { Cart } from './components/cart/Cart';
import { Checkout } from './components/checkout/Checkout';
import { OrderHistory } from './components/orders/OrderHistory';
import { OrderTracking } from './components/orders/OrderTracking';
import RestaurantOwnerDashboard from './components/orders/RestaurantOwnerDashboard';
import './App.css';

const App = () => {
  const { user, authReady } = useSupabase();
  const [page, setPage] = useState('products'); 
  const [cart, setCart] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const handleSignOut = useCallback(() => {
    supabase.auth.signOut().then(() => {
      setCart([]);
      setPage('auth'); 
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      if (page !== 'auth' && page !== 'restaurant-dashboard') {
        setPage('auth');
      }
      return;
    } 

    if (page === 'auth') {
      setPage('products');
    } else if (page === 'details' && !selectedOrder) {
      setPage('history');
    }
    
    if (page !== 'details' && selectedOrder) {
      setSelectedOrder(null);
    }
  }, [authReady, user, page, selectedOrder]); 

  const renderContent = () => {
    if (!authReady) return <Loading />;
    
    // Allow restaurant dashboard to handle its own auth
    if (page === 'restaurant-dashboard') {
      return <RestaurantOwnerDashboard />;
    }

    if (!user) {
      return <AuthPage onSuccess={() => setPage('products')} />;
    }

    switch (page) {
      case 'products':
        return <RestaurantListing setPage={setPage} cart={cart} setCart={setCart} />;
      case 'cart':
        return <Cart setPage={setPage} cart={cart} setCart={setCart} />;
      case 'checkout':
        if (cart.length === 0) {
          setPage('products');
          return null;
        }
        return <Checkout setPage={setPage} cart={cart} setCart={setCart} user={user} />;
      case 'history':
        return <OrderHistory setPage={setPage} user={user} setSelectedOrder={setSelectedOrder} />;
      case 'details':
        if (!selectedOrder) {
          setPage('history');
          return null;
        }
        return <OrderTracking order={selectedOrder} setPage={setPage} user={user} />;
      default:
        return <RestaurantListing setPage={setPage} cart={cart} setCart={setCart} />;
    }
  };

  const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  
  const navItems = [
    { key: 'products', label: 'Shops', icon: '🍔' },
    { key: 'cart', label: 'Basket', icon: `🧺`, count: cartItemCount },
    { key: 'history', label: 'Orders', icon: '🛵' },
  ];
  
  const displayUserId = useMemo(() => {
    if (user && user.email) return user.email.split('@')[0];
    if (user && user.id) return `User-${user.id.slice(0, 4)}`;
    return 'Guest';
  }, [user]);

  // Hide header and nav for restaurant dashboard
  const hideNavigation = page === 'restaurant-dashboard';

  return (
    <div className="h-screen flex flex-col items-center w-full" style={{ backgroundColor: LIGHT_BG }}>
      
      {!hideNavigation && (
        <header className="w-full shadow-lg p-3 z-20 sticky top-0" style={{ backgroundColor: ORANGE }}>
          <div className="flex justify-between items-center w-full max-w-3xl mx-auto"> 
            <h1 className="text-xl font-black text-white">ILIGAN <span className='text-sm font-light italic'>Food</span></h1>
            
            {user && (
              <div className="flex items-center text-white text-sm">
                <span className="mr-3 font-semibold hidden sm:inline">Hi, **{displayUserId}**</span>
                <button onClick={handleSignOut} className="px-3 py-1 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all font-bold">
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      <main className="w-full flex-1 overflow-y-auto"> 
        {renderContent()}
      </main>

      {user && !hideNavigation && (
        <nav className="flex-shrink-0 w-full shadow-2xl z-10" style={{ backgroundColor: 'white', borderTop: `1px solid ${BORDER}` }}>
          <div className="flex justify-around w-full max-w-3xl mx-auto">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={`flex flex-col items-center p-2 pt-3 text-xs font-semibold w-full sm:w-3/4 transition-colors relative ${page === item.key ? 'text-opacity-100' : 'text-opacity-60'}`}
                style={{ color: ORANGE }}
              >
                <span className="text-2xl mb-1">{item.icon}</span>
                {item.label}
                
                {item.count > 0 && item.key === 'cart' && (
                  <span className='absolute top-1 right-1/4 transform translate-x-1/2 bg-red-600 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center'>
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Owner Access Button - Fixed position */}
      {!hideNavigation && (
        <button
          onClick={() => setPage('restaurant-dashboard')}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 p-4 rounded-full shadow-2xl font-bold text-white transition-all hover:scale-110 z-30"
          style={{ backgroundColor: ORANGE }}
          title="Restaurant Owner Login"
        >
          <span className="text-2xl">🍽️</span>
        </button>
      )}
    </div>
  );
};
    
export default App;