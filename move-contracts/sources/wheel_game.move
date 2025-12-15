module movement_casino::wheel_game {
    use std::signer;
    use std::string::String;
    use std::vector;
    use std::hash;
    use std::bcs;
    use aptos_framework::timestamp;
    use aptos_framework::event;

    use movement_casino::common;

    // Wheel-specific error codes
    const E_INVALID_COLOR: u64 = 200;
    const E_INVALID_POSITION: u64 = 201;
    const E_INVALID_SEGMENT_CONFIG: u64 = 202;

    // Wheel segment structure
    struct WheelSegment has store, drop, copy {
        color: String, // "red", "black", "green"
        multiplier: u64,
        start_degree: u16,
        end_degree: u16,
    }

    // Game configuration
    struct WheelGameConfig has key {
        base_config: common::GameConfig,
        segments: vector<WheelSegment>,
    }

    // Game result structure
    struct WheelGameResult has drop, store {
        base_result: common::GameResultBase,
        bet_color: String,
        final_position: u16, // 0-359 degrees
        winning_color: String,
        winning_multiplier: u64,
    }

    // Game result event
    #[event]
    struct WheelGameResultEvent has drop, store {
        game_id: u64,
        player_address: address,
        bet_color: String,
        final_position: u16,
        winning_color: String,
        winning_multiplier: u64,
        bet_amount: u64,
        final_payout: u64,
        random_seed: u64,
        timestamp: u64,
    }

    // Initialize wheel game configuration
    public entry fun initialize(
        treasury: &signer,
        min_bet_amount: u64,
        max_bet_amount: u64,
        house_edge: u64,
    ) {
        let treasury_addr = signer::address_of(treasury);
        assert!(!exists<WheelGameConfig>(treasury_addr), common::error_game_not_initialized());
        
        let base_config = common::create_game_config(
            treasury_addr,
            min_bet_amount,
            max_bet_amount,
            house_edge,
        );

        // Initialize wheel segments with proper color mapping
        let segments = create_wheel_segments();

        move_to(treasury, WheelGameConfig {
            base_config,
            segments,
        });
    }

    // Create standard wheel segments configuration
    fun create_wheel_segments(): vector<WheelSegment> {
        let segments = vector::empty<WheelSegment>();
        
        // Standard wheel configuration: 50% red, 45% black, 5% green
        // Red segments: 0-179 degrees (50% of wheel)
        vector::push_back(&mut segments, WheelSegment {
            color: std::string::utf8(b"red"),
            multiplier: 20000, // 2x multiplier in basis points
            start_degree: 0u16,
            end_degree: 179u16,
        });

        // Black segments: 180-341 degrees (45% of wheel)
        vector::push_back(&mut segments, WheelSegment {
            color: std::string::utf8(b"black"),
            multiplier: 20000, // 2x multiplier in basis points
            start_degree: 180u16,
            end_degree: 341u16,
        });

        // Green segment: 342-359 degrees (5% of wheel, higher multiplier)
        vector::push_back(&mut segments, WheelSegment {
            color: std::string::utf8(b"green"),
            multiplier: 140000, // 14x multiplier in basis points
            start_degree: 342u16,
            end_degree: 359u16,
        });
        
        segments
    }

    // Play wheel game entry function
    public entry fun play_wheel(
        treasury: &signer,
        player_address: address,
        bet_amount: u64,
        bet_color: String,
    ) acquires WheelGameConfig {
        let treasury_addr = signer::address_of(treasury);
        assert!(exists<WheelGameConfig>(treasury_addr), common::error_game_not_initialized());
        
        let config = borrow_global<WheelGameConfig>(treasury_addr);
        
        // Basic validation
        assert!(
            common::validate_treasury_signer(treasury_addr, common::get_treasury_address(&config.base_config)),
            common::error_not_authorized()
        );
        assert!(
            common::validate_bet_amount(bet_amount, common::get_min_bet_amount(&config.base_config), common::get_max_bet_amount(&config.base_config)),
            common::error_invalid_bet_amount()
        );
        assert!(validate_bet_color(&bet_color), E_INVALID_COLOR);

        // Generate game ID and random seed
        let game_id = timestamp::now_microseconds();
        let random_seed = generate_random_seed(game_id, player_address);
        
        // Generate wheel position (0-359 degrees)
        let final_position = generate_wheel_position(random_seed);
        
        // Determine winning color and multiplier based on position
        let (winning_color, winning_multiplier) = determine_winning_segment(final_position, &config.segments);
        
        // Calculate payout
        let final_payout = calculate_wheel_payout(bet_amount, &bet_color, &winning_color, winning_multiplier);
        
        // Apply house edge
        let final_payout_with_edge = common::apply_house_edge(final_payout, common::get_house_edge(&config.base_config));
        
        let base_result = common::create_game_result_base(
            game_id,
            player_address,
            bet_amount,
            final_payout_with_edge,
            random_seed,
            timestamp::now_seconds(),
        );

        let _result = WheelGameResult {
            base_result,
            bet_color,
            final_position,
            winning_color,
            winning_multiplier,
        };

        // Emit event with complete game result
        event::emit(WheelGameResultEvent {
            game_id,
            player_address,
            bet_color,
            final_position,
            winning_color,
            winning_multiplier,
            bet_amount,
            final_payout: final_payout_with_edge,
            random_seed,
            timestamp: timestamp::now_seconds(),
        });
    }

    // Generate random seed using game ID and player address
    fun generate_random_seed(game_id: u64, player_address: address): u64 {
        // Use a combination of timestamp, game_id, and player address for randomness
        let addr_bytes = bcs::to_bytes(&player_address);
        let game_bytes = bcs::to_bytes(&game_id);
        let time_bytes = bcs::to_bytes(&timestamp::now_microseconds());
        
        // Combine all bytes for better randomness
        let combined = vector::empty<u8>();
        vector::append(&mut combined, addr_bytes);
        vector::append(&mut combined, game_bytes);
        vector::append(&mut combined, time_bytes);
        
        // Use hash of combined bytes as seed
        let hash_bytes = hash::sha3_256(combined);
        
        // Convert first 8 bytes to u64
        let seed = 0u64;
        let i = 0;
        while (i < 8 && i < vector::length(&hash_bytes)) {
            seed = seed * 256 + (*vector::borrow(&hash_bytes, i) as u64);
            i = i + 1;
        };
        seed
    }

    // Generate wheel position (0-359 degrees) from random seed
    fun generate_wheel_position(random_seed: u64): u16 {
        ((random_seed % 360) as u16)
    }

    // Determine winning segment based on wheel position
    fun determine_winning_segment(position: u16, segments: &vector<WheelSegment>): (String, u64) {
        let i = 0;
        while (i < vector::length(segments)) {
            let segment = vector::borrow(segments, i);
            if (position >= segment.start_degree && position <= segment.end_degree) {
                return (segment.color, segment.multiplier)
            };
            i = i + 1;
        };
        
        // Fallback - should never happen with proper segment configuration
        (std::string::utf8(b"red"), 20000)
    }

    // Calculate payout based on bet color and winning color
    fun calculate_wheel_payout(bet_amount: u64, bet_color: &String, winning_color: &String, winning_multiplier: u64): u64 {
        if (bet_color == winning_color) {
            common::calculate_payout(bet_amount, winning_multiplier)
        } else {
            0 // Player loses bet
        }
    }

    // Helper function to validate bet color
    fun validate_bet_color(color: &String): bool {
        let red = std::string::utf8(b"red");
        let black = std::string::utf8(b"black");
        let green = std::string::utf8(b"green");
        
        color == &red || color == &black || color == &green
    }

    // View functions
    #[view]
    public fun get_config(treasury_addr: address): (u64, u64, u64) acquires WheelGameConfig {
        assert!(exists<WheelGameConfig>(treasury_addr), common::error_game_not_initialized());
        let config = borrow_global<WheelGameConfig>(treasury_addr);
        (
            common::get_min_bet_amount(&config.base_config),
            common::get_max_bet_amount(&config.base_config),
            common::get_house_edge(&config.base_config)
        )
    }

    #[view]
    public fun get_segments(treasury_addr: address): vector<WheelSegment> acquires WheelGameConfig {
        assert!(exists<WheelGameConfig>(treasury_addr), common::error_game_not_initialized());
        let config = borrow_global<WheelGameConfig>(treasury_addr);
        config.segments
    }

    #[view]
    public fun is_initialized(treasury_addr: address): bool {
        exists<WheelGameConfig>(treasury_addr)
    }
}