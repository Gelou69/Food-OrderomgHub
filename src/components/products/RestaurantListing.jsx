// components/products/RestaurantListing.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../config/supabase';
import { ORANGE, NAVY, BORDER } from '../../config/constants';
import { Loading } from '../common/Loading';
import { SectionTitle } from '../common/SectionTitle';
import { FoodButton } from '../common/FoodButton';

export const RestaurantListing = ({ setPage, cart, setCart }) => {
  const [allFoodItems, setAllFoodItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  useEffect(() => {
    const fetchFoodData = async () => {
      setLoading(true);
      
      // 1. Fetch Categories
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
        
      if (categoryError) console.error('Error fetching categories:', categoryError);
      else setCategories(categoryData);
  
      // 2. Fetch Food Items
      const { data: foodData, error: foodError } = await supabase
        .from('food_items')
        .select(`
          food_item_id,
          name,
          price,
          stock,
          image_url,
          description,
          restaurants (
            id,
            name,
            image_url,
            address_barangay,
            is_open,
            categories (
              id,
              name,
              icon_url
            )
          )
        `)
        .eq('restaurants.is_open', true); 
  
      if (foodError) {
        console.error('Error fetching food items:', foodError);
      } else {
        const combinedData = foodData
          .filter(food => food.restaurants) 
          .map(food => ({
            ...food,
            id: food.food_item_id, 
            restaurant_id: food.restaurants.id,
            restaurant_name: food.restaurants.name,
            restaurant_image_url: food.restaurants.image_url,
            category_name: food.restaurants.categories?.name || 'Uncategorized',
          }));
        setAllFoodItems(combinedData);
      }
      
      setLoading(false);
    };
    
    fetchFoodData();
  }, []);

  const filteredItems = useMemo(() => {
    let items = allFoodItems;
    
    if (selectedCategory) {
      items = items.filter(item => item.category_name === selectedCategory.name);
    }
    
    if (selectedRestaurant) {
      items = items.filter(item => item.restaurant_id === selectedRestaurant.id);
    }
    
    return items;
  }, [allFoodItems, selectedCategory, selectedRestaurant]);

  const foodItemsByRestaurant = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
      const { restaurant_id, restaurant_name, restaurant_image_url } = item;
      if (!acc[restaurant_id]) {
        acc[restaurant_id] = { 
          id: restaurant_id, 
          name: restaurant_name, 
          image_url: restaurant_image_url,
          items: []
        };
      }
      acc[restaurant_id].items.push(item);
      return acc;
    }, {});
  }, [filteredItems]);

  const displayRestaurants = useMemo(() => Object.values(foodItemsByRestaurant), [foodItemsByRestaurant]);

  const addToCart = useCallback((foodItem, quantity = 1) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === foodItem.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === foodItem.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      } else {
        return [...prevCart, { ...foodItem, quantity, restaurant_name: foodItem.restaurant_name }];
      }
    });
  }, [setCart]);

  const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  if (loading) return <Loading />;

  return (
    <div className="p-4 md:p-6 mx-auto w-full max-w-3xl">
      <SectionTitle icon="🍽️" title="Local Iligan City Delivers" />
      
      {/* Category Filter */}
      <div className='flex overflow-x-auto space-x-2 pb-4 border-b mb-6' style={{borderColor: BORDER}}>
        <button 
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-full text-sm font-bold flex-shrink-0 transition-colors ${!selectedCategory ? 'text-white' : 'bg-white text-gray-700'}`}
          style={{ backgroundColor: !selectedCategory ? ORANGE : 'white', border: `1px solid ${ORANGE}` }}
        >
          All Shops
        </button>
        {categories.map(category => ( 
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-full text-sm font-bold flex-shrink-0 transition-colors flex items-center ${selectedCategory?.id === category.id ? 'text-white' : 'bg-white text-gray-700'}`}
            style={{ backgroundColor: selectedCategory?.id === category.id ? ORANGE : 'white', border: `1px solid ${ORANGE}` }}
          >
            {category.icon_url ? (
              <img src={category.icon_url} alt="" className="w-4 h-4 mr-1" />
            ) : (
              <span className='mr-1'>🍔</span> 
            )}
            {category.name}
          </button>
        ))}
      </div>
      
      {/* Restaurant and Menu Listing */}
      <div className='space-y-8'>
        {displayRestaurants.map(restaurant => (
          <div key={restaurant.id} className="bg-white p-4 rounded-xl shadow-lg">
            <div className="flex items-center mb-4">
              <img src={restaurant.image_url} alt={restaurant.name} className="w-12 h-12 object-cover rounded-full mr-4 border" style={{borderColor: BORDER}} />
              <h3 className="text-xl font-extrabold" style={{ color: NAVY }}>{restaurant.name}</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {restaurant.items.map(foodItem => (
                <div 
                  key={foodItem.id} 
                  className="p-3 rounded-lg border flex justify-between items-center" 
                  style={{ border: `1px solid ${BORDER}` }}
                >
                  <div className="flex items-center">
                    <img 
                      src={foodItem.image_url} 
                      alt={foodItem.name} 
                      className="w-12 h-12 object-cover mr-3 rounded" 
                      style={{borderColor: BORDER}}
                    />
                    <div>
                      <p className="text-sm font-semibold line-clamp-2">{foodItem.name}</p>
                      <p className="text-base font-extrabold mt-1" style={{ color: ORANGE }}>
                        ₱{foodItem.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  <FoodButton 
                    onClick={() => addToCart(foodItem)} 
                    variant="secondary"
                  >
                    + Add
                  </FoodButton>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* View Cart Button */}
      <div className="mt-8">
        <FoodButton 
          onClick={() => setPage('cart')} 
          className="py-3"
          disabled={cartItemCount === 0}
        >
          View Basket ({cartItemCount}) →
        </FoodButton>
      </div>
    </div>
  );
};