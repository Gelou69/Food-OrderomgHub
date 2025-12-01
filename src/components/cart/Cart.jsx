// components/cart/Cart.jsx
import React, { useMemo } from 'react';
import { ORANGE, NAVY, BORDER } from '../../config/constants';
import { SectionTitle } from '../common/SectionTitle';
import { FoodButton } from '../common/FoodButton';

export const Cart = ({ setPage, cart, setCart }) => {
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

  const updateQuantity = (id, change) => {
    setCart(prevCart => {
      const newCart = prevCart.map(item =>
        item.id === id ? { ...item, quantity: item.quantity + change } : item
      ).filter(item => item.quantity > 0);
      return newCart;
    });
  };

  if (cart.length === 0) {
    return (
      <div className="p-4 md:p-6 text-center h-full flex flex-col justify-center items-center mx-auto w-full max-w-3xl">
        <span className='text-6xl mb-4'>🛵</span>
        <h2 className="text-2xl font-bold mb-6" style={{ color: NAVY }}>Your Basket is Empty!</h2>
        <p className='text-gray-500 mb-8'>Time to order from Iligan's finest.</p>
        <div className='w-full max-w-sm'>
          <FoodButton onClick={() => setPage('products')}>Start Ordering</FoodButton>
        </div>
      </div>
    );
  }

  // Group cart items by restaurant
  const cartByRestaurant = useMemo(() => {
    return cart.reduce((acc, item) => {
      const restaurantName = item.restaurant_name || 'Unspecified Restaurant';
      if (!acc[restaurantName]) {
        acc[restaurantName] = [];
      }
      acc[restaurantName].push(item);
      return acc;
    }, {});
  }, [cart]);

  return (
    <div className="p-4 md:p-6 mx-auto w-full max-w-3xl">
      <SectionTitle icon="🍜" title="Review Your Order" />
      
      {Object.entries(cartByRestaurant).map(([restaurantName, items]) => (
        <div key={restaurantName} className="mb-6 p-4 bg-white rounded-xl shadow-md border" style={{borderColor: BORDER}}>
          <h4 className="font-bold text-lg mb-3" style={{ color: NAVY }}>{restaurantName}</h4>
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between pb-3 mb-3 border-b last:border-b-0 last:pb-0">
              <div className="flex items-center flex-grow">
                <img src={item.image_url} alt={item.name} className="w-12 h-12 object-cover rounded-md mr-4 border" style={{borderColor: BORDER}} />
                
                <div className='flex-grow min-w-0'>
                  <p className="font-semibold text-gray-800 line-clamp-2">{item.name}</p>
                  <p className="text-sm font-bold mt-1" style={{ color: ORANGE }}>₱{item.price.toFixed(2)}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                <button 
                  onClick={() => updateQuantity(item.id, -1)} 
                  className="w-7 h-7 flex items-center justify-center text-lg border rounded-full transition-colors"
                  style={{color: ORANGE, borderColor: ORANGE}}
                >
                  -
                </button>
                <span className="font-bold w-5 text-center">{item.quantity}</span>
                <button 
                  onClick={() => updateQuantity(item.id, 1)} 
                  className="w-7 h-7 flex items-center justify-center text-lg border rounded-full transition-colors"
                  style={{backgroundColor: ORANGE, color: 'white', borderColor: ORANGE}}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="mt-8 p-5 bg-white rounded-xl shadow-lg border" style={{borderColor: BORDER}}>
        <p className="text-xl text-black font-extrabold flex justify-between ">
          <span>Total Payable:</span>
          <span className="text-2xl" style={{ color: ORANGE }}>₱{total.toFixed(2)}</span>
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <FoodButton onClick={() => setPage('checkout')}>Proceed to Checkout</FoodButton>
        <FoodButton onClick={() => setPage('products')} variant="secondary">Add More</FoodButton>
      </div>
    </div>
  );
};