module movement_casino::plinko_game {
    use std::signer;
    use std::string::String;
    use std::vector;
    use aptos_framework::timestamp;
    use aptos_framework::event;

    use movement_casino::common;

    // Plinko-specific error codes
    const E_INVALID_ROW_COUNT: u64 = 300;
    const E_INVALID_RISK_LEVEL: u64 = 301;
    const E_INVALID_BUCKET: u64 = 302;

    // Plinko row configuration
    struct PlinkoRowConfig has store, drop, copy {
        row_count: u8,
        risk_level: String, // "Low", "Medium", "High"
        multipliers: vector<u64>,
    }

    // Game configuration
    struct PlinkoGameConfig has key {
        base_config: common::GameConfig,
        row_configs: vector<PlinkoRowConfig>,
    }

    // Game result structure
    struct PlinkoGameResult has drop, store {
        base_result: common::GameResultBase,
        row_count: u8,
        risk_level: String,
        ball_path: vector<bool>, // true = right, false = left
        final_bucket: u8,
        bucket_multiplier: u64,
    }

    // Game result event
    #[event]
    struct PlinkoGameResultEvent has drop, store {
        game_id: u64,
        player_address: address,
        row_count: u8,
        risk_level: String,
        ball_path: vector<bool>,
        final_bucket: u8,
        bucket_multiplier: u64,
        bet_amount: u64,
        final_payout: u64,
        random_seed: u64,
        timestamp: u64,
    }

    // Initialize plinko game configuration
    public entry fun initialize(
        treasury: &signer,
        min_bet_amount: u64,
        max_bet_amount: u64,
        house_edge: u64,
    ) {
        let treasury_addr = signer::address_of(treasury);
        assert!(!exists<PlinkoGameConfig>(treasury_addr), common::error_game_not_initialized());
        
        let base_config = common::create_game_config(
            treasury_addr,
            min_bet_amount,
            max_bet_amount,
            house_edge,
        );

        // Initialize row configurations with predefined multiplier tables
        let row_configs = vector::empty<PlinkoRowConfig>();
        
        // 8 rows - Low risk
        let low_8_multipliers = vector[5000, 13000, 30000, 50000, 120000, 50000, 30000, 13000, 5000]; // 9 buckets
        vector::push_back(&mut row_configs, PlinkoRowConfig {
            row_count: 8,
            risk_level: std::string::utf8(b"Low"),
            multipliers: low_8_multipliers,
        });
        
        // 8 rows - Medium risk
        let medium_8_multipliers = vector[10000, 30000, 50000, 120000, 410000, 120000, 50000, 30000, 10000]; // 9 buckets
        vector::push_back(&mut row_configs, PlinkoRowConfig {
            row_count: 8,
            risk_level: std::string::utf8(b"Medium"),
            multipliers: medium_8_multipliers,
        });
        
        // 8 rows - High risk
        let high_8_multipliers = vector[10000, 50000, 110000, 410000, 1000000, 410000, 110000, 50000, 10000]; // 9 buckets
        vector::push_back(&mut row_configs, PlinkoRowConfig {
            row_count: 8,
            risk_level: std::string::utf8(b"High"),
            multipliers: high_8_multipliers,
        });
        
        // 12 rows - Low risk
        let low_12_multipliers = vector[10000, 20000, 30000, 50000, 80000, 110000, 270000, 110000, 80000, 50000, 30000, 20000, 10000]; // 13 buckets
        vector::push_back(&mut row_configs, PlinkoRowConfig {
            row_count: 12,
            risk_level: std::string::utf8(b"Low"),
            multipliers: low_12_multipliers,
        });
        
        // 12 rows - Medium risk
        let medium_12_multipliers = vector[10000, 30000, 50000, 80000, 110000, 200000, 1000000, 200000, 110000, 80000, 50000, 30000, 10000]; // 13 buckets
        vector::push_back(&mut row_configs, PlinkoRowConfig {
            row_count: 12,
            risk_level: std::string::utf8(b"Medium"),
            multipliers: medium_12_multipliers,
        });
        
        // 12 rows - High risk
        let high_12_multipliers = vector[10000, 50000, 110000, 200000, 420000, 1000000, 2000000, 1000000, 420000, 200000, 110000, 50000, 10000]; // 13 buckets
        vector::push_back(&mut row_configs, PlinkoRowConfig {
            row_count: 12,
            risk_level: std::string::utf8(b"High"),
            multipliers: high_12_multipliers,
        });
        
        // 16 rows - Low risk
        let low_16_multipliers = vector[10000, 20000, 30000, 40000, 50000, 80000, 110000, 200000, 500000, 200000, 110000, 80000, 50000, 40000, 30000, 20000, 10000]; // 17 buckets
        vector::push_back(&mut row_configs, PlinkoRowConfig {
            row_count: 16,
            risk_level: std::string::utf8(b"Low"),
            multipliers: low_16_multipliers,
        });
        
        // 16 rows - Medium risk
        let medium_16_multipliers = vector[10000, 30000, 50000, 80000, 110000, 200000, 420000, 1000000, 1800000, 1000000, 420000, 200000, 110000, 80000, 50000, 30000, 10000]; // 17 buckets
        vector::push_back(&mut row_configs, PlinkoRowConfig {
            row_count: 16,
            risk_level: std::string::utf8(b"Medium"),
            multipliers: medium_16_multipliers,
        });
        
        // 16 rows - High risk
        let high_16_multipliers = vector[10000, 50000, 110000, 200000, 420000, 1000000, 1800000, 4200000, 10000000, 4200000, 1800000, 1000000, 420000, 200000, 110000, 50000, 10000]; // 17 buckets
        vector::push_back(&mut row_configs, PlinkoRowConfig {
            row_count: 16,
            risk_level: std::string::utf8(b"High"),
            multipliers: high_16_multipliers,
        });

        move_to(treasury, PlinkoGameConfig {
            base_config,
            row_configs,
        });
    }

    // Play plinko game entry function with ball path simulation
    public entry fun play_plinko(
        treasury: &signer,
        player_address: address,
        bet_amount: u64,
        row_count: u8,
        risk_level: String,
    ) acquires PlinkoGameConfig {
        let treasury_addr = signer::address_of(treasury);
        assert!(exists<PlinkoGameConfig>(treasury_addr), common::error_game_not_initialized());
        
        let config = borrow_global<PlinkoGameConfig>(treasury_addr);
        
        // Basic validation
        assert!(
            common::validate_treasury_signer(treasury_addr, common::get_treasury_address(&config.base_config)),
            common::error_not_authorized()
        );
        assert!(
            common::validate_bet_amount(bet_amount, common::get_min_bet_amount(&config.base_config), common::get_max_bet_amount(&config.base_config)),
            common::error_invalid_bet_amount()
        );

        // Validate row count and risk level
        assert!(row_count == 8 || row_count == 12 || row_count == 16, E_INVALID_ROW_COUNT);
        assert!(
            risk_level == std::string::utf8(b"Low") || 
            risk_level == std::string::utf8(b"Medium") || 
            risk_level == std::string::utf8(b"High"), 
            E_INVALID_RISK_LEVEL
        );

        // Find the appropriate row configuration
        let row_config = find_row_config(&config.row_configs, row_count, &risk_level);

        // Generate game ID and random seed
        let game_id = timestamp::now_microseconds();
        let random_seed = generate_random_seed(game_id, player_address, bet_amount);
        
        // Simulate ball path through peg grid
        let ball_path = simulate_ball_path(row_count, random_seed);
        
        // Determine final bucket based on ball path
        let final_bucket = calculate_final_bucket(&ball_path);
        
        // Get bucket multiplier from configuration
        let bucket_multiplier = *vector::borrow(&row_config.multipliers, (final_bucket as u64));
        
        // Calculate final payout
        let raw_payout = common::calculate_payout(bet_amount, bucket_multiplier);
        let final_payout = common::apply_house_edge(raw_payout, common::get_house_edge(&config.base_config));
        
        let base_result = common::create_game_result_base(
            game_id,
            player_address,
            bet_amount,
            final_payout,
            random_seed,
            timestamp::now_seconds(),
        );

        let _result = PlinkoGameResult {
            base_result,
            row_count,
            risk_level,
            ball_path,
            final_bucket,
            bucket_multiplier,
        };

        // Emit event with complete game details
        event::emit(PlinkoGameResultEvent {
            game_id,
            player_address,
            row_count,
            risk_level,
            ball_path,
            final_bucket,
            bucket_multiplier,
            bet_amount,
            final_payout,
            random_seed,
            timestamp: timestamp::now_seconds(),
        });
    }

    // View functions
    #[view]
    public fun get_config(treasury_addr: address): (u64, u64, u64) acquires PlinkoGameConfig {
        assert!(exists<PlinkoGameConfig>(treasury_addr), common::error_game_not_initialized());
        let config = borrow_global<PlinkoGameConfig>(treasury_addr);
        (
            common::get_min_bet_amount(&config.base_config),
            common::get_max_bet_amount(&config.base_config),
            common::get_house_edge(&config.base_config)
        )
    }

    #[view]
    public fun is_initialized(treasury_addr: address): bool {
        exists<PlinkoGameConfig>(treasury_addr)
    }

    // Helper function to find row configuration
    fun find_row_config(configs: &vector<PlinkoRowConfig>, row_count: u8, risk_level: &String): &PlinkoRowConfig {
        let i = 0;
        let len = vector::length(configs);
        while (i < len) {
            let config = vector::borrow(configs, i);
            if (config.row_count == row_count && &config.risk_level == risk_level) {
                return config
            };
            i = i + 1;
        };
        abort E_INVALID_ROW_COUNT
    }

    // Generate random seed using game parameters (simplified)
    fun generate_random_seed(game_id: u64, _player_address: address, bet_amount: u64): u64 {
        // Simple randomness without address serialization to avoid to_bytes issues
        let seed = game_id ^ bet_amount ^ timestamp::now_microseconds();
        seed
    }

    // Simulate ball path through peg grid using random bounces
    fun simulate_ball_path(row_count: u8, random_seed: u64): vector<bool> {
        let ball_path = vector::empty<bool>();
        let current_seed = random_seed;
        
        let i = 0;
        while (i < row_count) {
            // Generate pseudo-random bounce direction
            current_seed = (current_seed * 1103515245 + 12345) % (1 << 31);
            let bounce_right = (current_seed % 2) == 1;
            vector::push_back(&mut ball_path, bounce_right);
            i = i + 1;
        };
        
        ball_path
    }

    // Calculate final bucket based on ball path
    fun calculate_final_bucket(ball_path: &vector<bool>): u8 {
        // Count right and left bounces to determine final position
        let right_count = 0u64;
        let left_count = 0u64;
        let i = 0;
        let path_length = vector::length(ball_path);
        
        while (i < path_length) {
            let bounce_right = *vector::borrow(ball_path, i);
            if (bounce_right) {
                right_count = right_count + 1;
            } else {
                left_count = left_count + 1;
            };
            i = i + 1;
        };
        
        // Calculate final bucket position
        // For n rows, there are n+1 buckets (0 to n)
        // Position is determined by the difference between right and left bounces
        let row_count = vector::length(ball_path);
        let half_rows = row_count / 2;
        
        let bucket_index = if (right_count >= left_count) {
            let net_right = right_count - left_count;
            if (half_rows + net_right > row_count) {
                row_count
            } else {
                half_rows + net_right
            }
        } else {
            let net_left = left_count - right_count;
            if (net_left > half_rows) {
                0
            } else {
                half_rows - net_left
            }
        };
        
        (bucket_index as u8)
    }
}