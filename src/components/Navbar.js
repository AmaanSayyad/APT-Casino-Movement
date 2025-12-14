"use client";
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
// Removed Movement wallet adapter - using Movement wallet instead
import { useSelector, useDispatch } from 'react-redux';
import { setBalance, setLoading, loadBalanceFromStorage, addToBalance, subtractFromBalance } from '@/store/balanceSlice';
import MovementWalletButton from "./MovementWalletButton";
import WithdrawModal from "./WithdrawModal";
import NavbarBalance from "./NavbarBalance";
import dynamic from 'next/dynamic';
const LiveChat = dynamic(() => import('./LiveChat'), { ssr: false });


import { useNotification } from './NotificationSystem';
import { UserBalanceSystem, parseAptAmount, aptosClient, TREASURY_ADDRESS } from '@/lib/movement';
import { useBackendDeposit } from '@/hooks/useBackendDeposit';
import { useMovementWallet } from '@/hooks/useMovementWallet';
import { useMovementBalance } from '@/hooks/useMovementBalance';
import { useMovementTransactions } from '@/hooks/useMovementTransactions';

// Mock search results for demo purposes
const MOCK_SEARCH_RESULTS = {
  games: [
    { id: 'game1', name: 'Roulette', path: '/game/roulette', type: 'Featured' },
    { id: 'game2', name: 'Mines', path: '/game/mines', type: 'Popular' },
    { id: 'game3', name: 'Spin Wheel', path: '/game/wheel', type: 'Featured' },
    { id: 'game4', name: 'Plinko', path: '/game/plinko', type: 'Popular' },
  ],
  tournaments: [
    { id: 'tournament1', name: 'High Roller Tournament', path: '/tournaments/high-roller', prize: '10,000 MOVE' },
    { id: 'tournament2', name: 'Weekend Battle', path: '/tournaments/weekend-battle', prize: '5,000 MOVE' },
  ],
  pages: [
    { id: 'page1', name: 'Bank', path: '/bank', description: 'Deposit and withdraw funds' },
    { id: 'page2', name: 'Profile', path: '/profile', description: 'Your account details' },
  ]
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userAddress, setUserAddress] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const searchInputRef = useRef(null);
  const searchPanelRef = useRef(null);
  const notification = useNotification();
  const isDev = process.env.NODE_ENV === 'development';
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const dispatch = useDispatch();
  const { userBalance, isLoading: isLoadingBalance } = useSelector((state) => state.balance);
  
  // Redux balance state available
  const [walletNetworkName, setWalletNetworkName] = useState("");

  // User balance management
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("0");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);

  // Movement wallet connection
  const movementWallet = useMovementWallet();
  const movementBalance = useMovementBalance();
  const movementTransactions = useMovementTransactions();
  
  // Legacy variables for compatibility (can be removed later)
  const isConnected = movementWallet.isConnected;
  const address = movementWallet.address;
  const isWalletReady = movementWallet.isConnected;

  // Movement hooks already defined above

  // Backend deposit hook - disabled for Movement integration
  // const { deposit: backendDeposit, isDepositing: isBackendDepositing } = useBackendDeposit({ 
  //   signAndSubmitTransaction 
  // });

  // Mock notifications for UI purposes
  const [notifications, setNotifications] = useState([
    {
      id: '1',
      title: 'Balance Updated',
      message: 'Your MOVE balance has been updated',
      isRead: false,
      time: '2 min ago'
    },
    {
      id: '2',
      title: 'New Tournament',
      message: 'High Roller Tournament starts in 1 hour',
      isRead: false,
      time: '1 hour ago'
    }
  ]);

  // Load user balance from house account
  const loadUserBalance = async () => {
    if (!address) return;
    
    try {
      dispatch(setLoading(true));
      const balance = await UserBalanceSystem.getBalance(address);
      dispatch(setBalance(balance));
    } catch (error) {
      console.error('Error loading user balance:', error);
      dispatch(setBalance("0"));
    } finally {
      dispatch(setLoading(false));
    }
  };

  // Load balance when wallet connects
  useEffect(() => {
    if (isWalletReady && address) {
      // First try to load from localStorage
      const savedBalance = loadBalanceFromStorage();
      if (savedBalance && savedBalance !== "0") {
        // Loading saved balance from localStorage
        dispatch(setBalance(savedBalance));
      } else {
        // If no saved balance, load from blockchain
        loadUserBalance();
      }
    }
  }, [isWalletReady, address]);

  // Check if wallet was previously connected on page load
  useEffect(() => {
    const checkWalletConnection = async () => {
      // Check if Movement wallet extension is available
      if (window.movement && window.movement.account) {
        console.log('Wallet already connected on page load');
        // The wallet adapter should automatically reconnect
      }
    };
    
    checkWalletConnection();
  }, []);

  useEffect(() => {
    setIsClient(true);
    setUnreadNotifications(notifications.filter(n => !n.isRead).length);
    
    // Initialize dark mode from local storage if available
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      setIsDarkMode(savedMode === 'true');
    }
    
    // Movement wallet integration - simplified for testnet only
    // In development mode, use mock data
    if (isDev) {
      setUserAddress('0x1234...dev');
    }
    
    // Handle click outside search panel
    const handleClickOutside = (event) => {
      if (
        searchPanelRef.current && 
        !searchPanelRef.current.contains(event.target) &&
        !searchInputRef.current?.contains(event.target)
      ) {
        setShowSearch(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDev, notifications]);

  // Close balance modal with ESC
  useEffect(() => {
    if (!showBalanceModal) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowBalanceModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showBalanceModal]);
  
  // Poll for balance changes
  const pollForBalance = async (initialBalance, attempts = 10, interval = 2000) => {
    dispatch(setLoading(true));
    for (let i = 0; i < attempts; i++) {
      try {
        const newBalance = await UserBalanceSystem.getBalance(address);
        if (newBalance !== initialBalance) {
          dispatch(setBalance(newBalance));
          notification.success('Balance updated successfully!');
          dispatch(setLoading(false));
          return;
        }
      } catch (error) {
        console.error(`Polling attempt ${i + 1} failed:`, error);
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    notification.error('Balance update timed out. Please refresh manually.');
    dispatch(setLoading(false));
  };

  // Handle withdraw using Movement transactions
  const handleWithdraw = async () => {
    if (!movementWallet.isConnected || !movementWallet.address) {
      notification.error('Please connect your Movement wallet first');
      return;
    }

    const currentBalance = parseFloat(userBalance) || 0;
    if (currentBalance <= 0) {
      notification.error('No house balance to withdraw');
      return;
    }

    try {
      setIsWithdrawing(true);
      
      // Withdraw all house balance
      const withdrawAmount = currentBalance;
      
      // Update house balance first (optimistic update)
      dispatch(subtractFromBalance(withdrawAmount));
      
      // For now, just simulate withdrawal (backend integration needed for actual MOVE transfer)
      const result = await movementTransactions.requestWithdrawal(withdrawAmount);
      
      if (result.success) {
        notification.success(`Successfully withdrew ${withdrawAmount} MOVE from house balance!`);
        
        // Close the modal
        setShowBalanceModal(false);
      } else {
        // Revert balance if failed
        dispatch(addToBalance(withdrawAmount));
        throw new Error(result.error || 'Withdrawal request failed');
      }
      
    } catch (error) {
      console.error('Withdraw error:', error);
      notification.error(`Withdrawal failed: ${error.message}`);
      
      // Revert balance on error
      dispatch(addToBalance(withdrawAmount));
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Handle deposit to house balance
  // Wallet reconnection helper
  const reconnectWallet = async () => {
    try {
      if (window.movement) {
        await window.movement.connect();
        notification.success('Wallet reconnected successfully!');
      }
    } catch (error) {
      notification.error('Failed to reconnect wallet. Please refresh the page.');
    }
  };

  // Handle deposit using Movement transactions
  const handleDeposit = async () => {
    if (!movementWallet.isConnected || !movementWallet.address) {
      notification.error('Please connect your Movement wallet first');
      return;
    }

    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      notification.error('Please enter a valid deposit amount');
      return;
    }

    setIsDepositing(true);
    try {
      console.log('💰 MOVEMENT DEPOSIT:', { address: movementWallet.address, amount });
      
      // Use Movement transactions hook
      const result = await movementTransactions.depositToTreasury(amount);
      
      if (result.success) {
        notification.success(`Successfully deposited ${amount} MOVE! TX: ${result.transactionHash?.slice(0, 8)}...`);
        setDepositAmount("");
        
        // Update house balance in Redux store
        dispatch(addToBalance(amount));
        
        // Refresh wallet balance
        movementBalance.refreshWalletBalance();
      } else {
        throw new Error(result.error || 'Deposit failed');
      }
      
    } catch (error) {
      console.error('❌ Deposit failed:', error);
      notification.error(`Deposit failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsDepositing(false);
    }
  };

  // Handle search input
  useEffect(() => {
    if (searchQuery.length > 1) {
      // In a real app, you would call an API here
      // For demo, we'll filter the mock data
      const query = searchQuery.toLowerCase();
      const games = MOCK_SEARCH_RESULTS.games.filter(
        game => game.name.toLowerCase().includes(query)
      );
      const tournaments = MOCK_SEARCH_RESULTS.tournaments.filter(
        tournament => tournament.name.toLowerCase().includes(query)
      );
      const pages = MOCK_SEARCH_RESULTS.pages.filter(
        page => page.name.toLowerCase().includes(query) || 
               (page.description && page.description.toLowerCase().includes(query))
      );
      
      setSearchResults({ games, tournaments, pages });
    } else {
      setSearchResults(null);
    }
  }, [searchQuery]);

  const navLinks = [
    {
      name: "Home",
      path: "/",
      classes: "text-hover-gradient-home",
    },
    {
      name: "Game",
      path: "/game",
      classes: "text-hover-gradient-game",
    },
    {
      name: "Bank",
      path: "/bank",
      classes: "text-hover-gradient-bank",
    },
    {
      name: "Live",
      path: "/live",
      classes: "text-hover-gradient-live",
    },
  ];

  const handleProfileClick = () => {
    router.push("/profile");
  };
  
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
    // Here you would also apply the theme change to your app
  };
  
  const markNotificationAsRead = (id) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? {...n, isRead: true} : n)
    );
    setUnreadNotifications(prev => Math.max(0, prev - 1));
  };
  
  const clearAllNotifications = () => {
    setNotifications(prev => prev.map(n => ({...n, isRead: true})));
    setUnreadNotifications(0);
    setShowNotificationsPanel(false);
    notification.success("All notifications marked as read");
  };
  
  const handleSearchIconClick = () => {
    setShowSearch(prev => !prev);
    if (!showSearch) {
      // Focus the search input when opening
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };
  
  const handleSearchItemClick = (path) => {
    router.push(path);
    setShowSearch(false);
    setSearchQuery('');
  };

  // Detect Movement wallet network (best-effort)
  useEffect(() => {
    const readNetwork = async () => {
      try {
        if (typeof window !== 'undefined' && window.movement?.network) {
          const n = await window.movement.network();
          if (n?.name) setWalletNetworkName(String(n.name).toLowerCase());
        }
      } catch {}
    };
    readNetwork();
    const off = window?.movement?.onNetworkChange?.((n) => {
      try { setWalletNetworkName(String(n?.name || '').toLowerCase()); } catch {}
    });
    return () => {
      try { off && off(); } catch {}
    };
  }, []);

  // switchToTestnet function removed - now handled by MainnetWarning component

  return (
    <nav className="backdrop-blur-md bg-[#070005]/90 fixed w-full z-20 transition-all duration-300 shadow-lg">
      <div className="flex w-full items-center justify-between py-6 px-4 sm:px-10 md:px-20 lg:px-36">
        <div className="flex items-center">
          <a href="/" className="logo mr-6">
          <Image
            src="/PowerPlay.png"
            alt="powerplay image"
            width={172}
            height={15}
            />
          </a>
          
          {/* Mobile menu button */}
          <button 
            className="md:hidden text-white p-1 rounded-lg hover:bg-purple-500/20 transition-colors"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-label="Toggle mobile menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {showMobileMenu ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </>
              )}
            </svg>
          </button>
        </div>
        
        {/* Desktop Navigation Links */}
        <div className="hidden md:flex font-display gap-8 lg:gap-12 items-center">
          {navLinks.map(({ name, path, classes }, index) => (
            <div key={index} className="relative group">
            <Link
                className={`${path === pathname ? "text-transparent bg-clip-text bg-gradient-to-r from-red-magic to-blue-magic font-semibold" : classes} flex items-center gap-1 text-lg font-medium transition-all duration-200 hover:scale-105 whitespace-nowrap shrink-0`}
              href={path}
            >
              {name}
            </Link>
            </div>
          ))}
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          {/* Search Icon */}
          <div className="relative">
            <button 
              className="p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-purple-500/20"
              onClick={handleSearchIconClick}
              aria-label="Search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
            
            {/* Search Panel */}
            {showSearch && (
              <div 
                className="absolute right-0 mt-2 w-80 md:w-96 bg-[#1A0015]/95 backdrop-blur-md border border-purple-500/30 rounded-lg shadow-xl z-40 animate-fadeIn"
                ref={searchPanelRef}
              >
                <div className="p-3">
                  <div className="relative">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search games, tournaments..."
                      className="w-full py-2 px-3 pr-10 bg-[#250020] border border-purple-500/20 rounded-md text-white focus:outline-none focus:border-purple-500"
                    />
                    <svg 
                      className="absolute right-3 top-2.5 text-white/50" 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>
                </div>
                
                {searchQuery.length > 1 && (
                  <div className="max-h-96 overflow-y-auto">
                    {(!searchResults || 
                      (searchResults.games.length === 0 && 
                       searchResults.tournaments.length === 0 && 
                       searchResults.pages.length === 0)) ? (
                      <div className="p-4 text-center text-white/50">
                        No results found
                      </div>
                    ) : (
                      <>
                        {/* Games */}
                        {searchResults.games.length > 0 && (
                          <div className="p-2">
                            <h3 className="text-xs font-medium text-white/50 uppercase px-3 mb-1">Games</h3>
                            {searchResults.games.map(game => (
                              <div 
                                key={game.id}
                                className="p-2 hover:bg-purple-500/10 rounded-md cursor-pointer mx-1"
                                onClick={() => handleSearchItemClick(game.path)}
                              >
                                <div className="flex items-center">
                                  <div className="w-8 h-8 rounded-md bg-purple-800/30 flex items-center justify-center mr-3">
                                    <span className="text-sm">{game.name.charAt(0)}</span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-white">{game.name}</p>
                                    <span className="text-xs text-white/50">{game.type}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Tournaments */}
                        {searchResults.tournaments.length > 0 && (
                          <div className="p-2">
                            <h3 className="text-xs font-medium text-white/50 uppercase px-3 mb-1">Tournaments</h3>
                            {searchResults.tournaments.map(tournament => (
                              <div 
                                key={tournament.id}
                                className="p-2 hover:bg-purple-500/10 rounded-md cursor-pointer mx-1"
                                onClick={() => handleSearchItemClick(tournament.path)}
                              >
                                <div className="flex items-center">
                                  <div className="w-8 h-8 rounded-md bg-red-800/30 flex items-center justify-center mr-3">
                                    <span className="text-sm">🏆</span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-white">{tournament.name}</p>
                                    <span className="text-xs text-white/50">Prize: {tournament.prize}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Pages */}
                        {searchResults.pages.length > 0 && (
                          <div className="p-2">
                            <h3 className="text-xs font-medium text-white/50 uppercase px-3 mb-1">Pages</h3>
                            {searchResults.pages.map(page => (
                              <div 
                                key={page.id}
                                className="p-2 hover:bg-purple-500/10 rounded-md cursor-pointer mx-1"
                                onClick={() => handleSearchItemClick(page.path)}
                              >
                                <div className="flex items-center">
                                  <div className="w-8 h-8 rounded-md bg-blue-800/30 flex items-center justify-center mr-3">
                                    <span className="text-sm">{page.name.charAt(0)}</span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-white">{page.name}</p>
                                    {page.description && (
                                      <span className="text-xs text-white/50">{page.description}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                
                {searchQuery.length > 0 && (
                  <div className="p-2 border-t border-purple-500/20 text-center">
                    <span className="text-xs text-white/50">
                      Press Enter to search for "{searchQuery}"
                </span>
                  </div>
                )}
              </div>
            )}
          </div>
        
          {/* Live Chat Toggle */}
          <button 
            onClick={() => setChatOpen(true)}
            className="p-2 text-white/70 hover:text-white transition-colors hidden md:block rounded-full hover:bg-purple-500/20"
            aria-label="Open live chat"
          >
            💬
          </button>

          {/* Theme Toggle */}
          <button 
            onClick={toggleDarkMode}
            className="p-2 text-white/70 hover:text-white transition-colors hidden md:block rounded-full hover:bg-purple-500/20"
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v2"></path>
                <path d="M12 20v2"></path>
                <path d="M5 5l1.5 1.5"></path>
                <path d="M17.5 17.5l1.5 1.5"></path>
                <path d="M2 12h2"></path>
                <path d="M20 12h2"></path>
                <path d="M5 19l1.5-1.5"></path>
                <path d="M17.5 6.5l1.5-1.5"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>
          
          {/* Notifications */}
          <div className="relative hidden md:block">
            <button 
              onClick={() => setShowNotificationsPanel(!showNotificationsPanel)}
              className="p-2 text-white/70 hover:text-white transition-colors relative rounded-full hover:bg-purple-500/20"
              aria-label="Notifications"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold">
                  {unreadNotifications}
                </span>
              )}
            </button>
            
            {/* Notifications Panel */}
            {showNotificationsPanel && (
              <div className="absolute right-0 mt-2 w-80 bg-[#1A0015]/95 backdrop-blur-md border border-purple-500/30 rounded-lg shadow-xl z-30 animate-fadeIn">
                <div className="p-3 border-b border-purple-500/20 flex justify-between items-center">
                  <h3 className="font-medium text-white">Notifications</h3>
                  <button 
                    onClick={clearAllNotifications}
                    className="text-xs text-white/50 hover:text-white"
                  >
                    Mark all as read
                  </button>
                </div>
                
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-white/50">
                      No notifications
                    </div>
                  ) : (
                    notifications.map(notification => (
                      <div 
                        key={notification.id}
                        className={`p-3 border-b border-purple-500/10 hover:bg-purple-500/5 cursor-pointer ${!notification.isRead ? 'bg-purple-900/10' : ''}`}
                        onClick={() => markNotificationAsRead(notification.id)}
                      >
                        <div className="flex justify-between">
                          <h4 className="font-medium text-white text-sm">{notification.title}</h4>
                          <span className="text-xs text-white/40">{notification.time}</span>
                        </div>
                        <p className="text-xs text-white/70 mt-1">{notification.message}</p>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-red-500 rounded-full absolute top-3 right-3"></div>
                        )}
                      </div>
                    ))
                  )}
                </div>
                
                <div className="p-2 border-t border-purple-500/20 text-center">
                  <a href="/notifications" className="text-xs text-white/70 hover:text-white">
                    View all notifications
                  </a>
                </div>
              </div>
            )}
          </div>
          

          
          {/* House Balance Display */}
          <NavbarBalance
            balance={userBalance}
            isConnected={movementWallet.isConnected && movementWallet.isCorrectNetwork}
            isLoading={isLoadingBalance}
            onDeposit={() => setShowBalanceModal(true)}
          />
          

          
          {/* Movement Wallet Button */}
          <MovementWalletButton />
  
        </div>
      </div>
      {chatOpen && (
        <LiveChat open={chatOpen} onClose={() => setChatOpen(false)} />
      )}
      
      {/* Mobile Navigation Menu */}
      {showMobileMenu && (
        <div className="md:hidden bg-[#0A0008]/95 backdrop-blur-md p-4 border-t border-purple-500/20 animate-slideDown">
          <div className="flex flex-col space-y-3">
            {navLinks.map(({ name, path, classes }, index) => (
              <div key={index}>
                <Link
                  className={`${path === pathname ? 'text-white font-semibold' : 'text-white/80'} py-2 px-3 rounded-md hover:bg-purple-500/10 flex items-center w-full text-lg`}
                  href={path}
                  onClick={() => setShowMobileMenu(false)}
                >
                  {name}
                </Link>
              </div>
            ))}
            {/* Switch to Testnet button removed - now handled by MainnetWarning component */}
            <div className="flex justify-between items-center py-2 px-3">
              <span className="text-white/70">Dark Mode</span>
              <button 
                onClick={toggleDarkMode}
                className="p-2 text-white/70 hover:text-white bg-purple-500/10 rounded-full flex items-center justify-center h-8 w-8"
              >
                {isDarkMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M12 2v2"></path>
                    <path d="M12 20v2"></path>
                    <path d="M5 5l1.5 1.5"></path>
                    <path d="M17.5 17.5l1.5 1.5"></path>
                    <path d="M2 12h2"></path>
                    <path d="M20 12h2"></path>
                    <path d="M5 19l1.5-1.5"></path>
                    <path d="M17.5 6.5l1.5-1.5"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                )}
              </button>
            </div>
            
            {/* Movement Balance in Mobile Menu */}
            {movementWallet.isConnected && movementWallet.isCorrectNetwork && (
              <div className="pt-2 mt-2 border-t border-purple-500/10">
                <div className="p-3 bg-gradient-to-r from-purple-900/20 to-purple-800/10 rounded-lg border border-purple-800/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-300">Balance:</span>
                    <span className="text-sm text-purple-300 font-medium">
                      {isLoadingBalance ? 'Loading...' : `${userBalance} MOVE`}
                    </span>
                  </div>
                  <div className="flex">
                    <button
                      onClick={() => {
                        setShowBalanceModal(true);
                        setShowMobileMenu(false);
                      }}
                      className="w-full text-xs bg-green-600/30 hover:bg-green-500/30 text-green-300 px-3 py-2 rounded transition-colors"
                    >
                      Deposit
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="pt-2 mt-2 border-t border-purple-500/10">
              <a 
                href="#support" 
                className="block py-2 px-3 text-white/80 hover:text-white hover:bg-purple-500/10 rounded-md"
                onClick={() => setShowMobileMenu(false)}
              >
                Support
              </a>
            </div>
          </div>
        </div>
      )}
      
      {/* Balance Management Modal (portal) */}
      {isClient && showBalanceModal && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowBalanceModal(false)}
        >
          <div
            className="bg-[#0A0008] border border-purple-500/20 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Balance Management</h3>
              <button
                onClick={() => setShowBalanceModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Current House Balance */}
            <div className="mb-4 p-3 bg-gradient-to-r from-purple-900/20 to-purple-800/10 rounded-lg border border-purple-800/30">
              <span className="text-sm text-gray-300">House Balance:</span>
              <div className="text-lg text-purple-300 font-bold">
                {isLoadingBalance ? 'Loading...' : `${userBalance} MOVE`}
              </div>
            </div>
            
            {/* Current Wallet Balance */}
            <div className="mb-4 p-3 bg-gradient-to-r from-green-900/20 to-green-800/10 rounded-lg border border-green-800/30">
              <span className="text-sm text-gray-300">Wallet Balance:</span>
              <div className="text-lg text-green-300 font-bold">
                {movementBalance.isLoading ? 'Loading...' : movementBalance.formattedWalletBalance + ' MOVE'}
              </div>
            </div>
            
            {/* Deposit Section */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-white mb-2">Deposit MOVE</h4>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Enter MOVE amount"
                  className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-600/50 rounded text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/25"
                  min="0"
                  step="0.00000001"
                  disabled={isDepositing}
                />
                <button
                  onClick={handleDeposit}
                  disabled={!isConnected || !depositAmount || parseFloat(depositAmount) <= 0 || isDepositing}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded font-medium transition-colors flex items-center gap-2"
                >
                  {isDepositing ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full"></div>
                      Depositing...
                    </>
                  ) : (
                    <>
                      Deposit
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8l-8-8-8 8" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Transfer MOVE from your wallet to treasury for gaming
              </p>
              {/* Quick Deposit Buttons */}
              <div className="flex gap-1 mt-2">
                {[0.1, 0.5, 1, 5].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setDepositAmount(amount.toString())}
                    className="flex-1 px-2 py-1 text-xs bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded transition-colors"
                    disabled={isDepositing}
                  >
                    {amount} MOVE
                  </button>
                ))}
              </div>
            </div>

            {/* Withdraw Section */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-white mb-2">Withdraw MOVE</h4>
              <button
                onClick={handleWithdraw}
                disabled={!movementWallet.isConnected || !userBalance || parseFloat(userBalance) <= 0 || isWithdrawing}
                className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isWithdrawing ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full"></div>
                    Processing...
                  </>
                ) : movementWallet.isConnected ? (
                  (userBalance && parseFloat(userBalance) > 0) ? 'Withdraw MOVE' : 'No House Balance'
                ) : 'Connect Wallet'}
                {movementWallet.isConnected && userBalance && parseFloat(userBalance) > 0 && !isWithdrawing && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
              {movementWallet.isConnected && userBalance && parseFloat(userBalance) > 0 && (
                <p className="text-xs text-gray-400 mt-1 text-center">
                  Withdraw {userBalance} MOVE from your house balance
                </p>
              )}
            </div>
            
            {/* Refresh Balance */}
            <div className="mt-6">
              <button
                onClick={() => {
                  // Only refresh from localStorage, don't try blockchain
                  const savedBalance = loadBalanceFromStorage();
                  if (savedBalance && savedBalance !== "0") {
                    console.log('Refreshing balance from localStorage:', savedBalance);
                    dispatch(setBalance(savedBalance));
                  } else {
                    console.log('No saved balance in localStorage');
                  }
                }}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
              >
                Refresh Balance
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      <div className="w-full h-[2px] magic-gradient overflow-hidden"></div>
    </nav>
  );
}