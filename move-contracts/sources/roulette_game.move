module movement_casino::roulette_game {
    use std::signer;
    use std::string::String;
    use std::vector;
    use aptos_framework::timestamp;
    use aptos_framework::event;

    use movement_casino::common;

    // Roulette-specific error codes
    const E_INVALID_BET_TYPE: u64 = 400;
    const E_INVALID_BET_VALUE: u64 = 401;
    const E_INVALID_NUMBER: u64 = 402;
    const E_NO_BETS_PLACED: u64 = 403;

    // Roulette bet structure
    struct RouletteBet has store, drop, copy {
        bet_type: String, // "number", "color", "odd", "even", "high", "low"
        bet_value: String, // "5", "red", "odd", etc.
        bet_amount: u64,
    }

    // Game configuration
    struct RouletteGameConfig has key {
        base_config: common::GameConfig,
        number_payouts: vector<u64>, // 0-36 payouts
        color_payouts: vector<u64>, // red, black, green
        other_payouts: vector<u64>, // odd, even, high, low
    }

    // Game result structure
    struct RouletteGameResult has drop, store {
        base_result: common::GameResultBase,
        bets: vector<RouletteBet>,
        winning_number: u8, // 0-36
        winning_color: String, // "red", "black", "green"
        winning_parity: String, // "odd", "even", "zero"
        total_payout: u64,
    }

    // Game result event
    #[event]
    struct RouletteGameResultEvent has drop, store {
        game_id: u64,
        player_address: address,
        bets: vector<RouletteBet>,
        winning_number: u8,
        winning_color: String,
        winning_parity: String,
        total_bet_amount: u64,
        total_payout: u64,
        random_seed: u64,
        timestamp: u64,
    }

    // Initialize roulette game configuration
    public entry fun initialize(
        treasury: &signer,
        min_bet_amount: u64,
        max_bet_amount: u64,
        house_edge: u64,
    ) {
        let treasury_addr = signer::address_of(treasury);
        assert!(!exists<RouletteGameConfig>(treasury_addr), common::error_game_not_initialized());
        
        let base_config = common::create_game_config(
            treasury_addr,
            min_bet_amount,
            max_bet_amount,
            house_edge,
        );

        // Initialize payout tables with standard roulette payouts
        let number_payouts = create_number_payouts();
        let color_payouts = create_color_payouts();
        let other_payouts = create_other_payouts();

        move_to(treasury, RouletteGameConfig {
            base_config,
            number_payouts,
            color_payouts,
            other_payouts,
        });
    }

    // Create standard number payouts (0-36, straight up bet pays 35:1)
    fun create_number_payouts(): vector<u64> {
        let payouts = vector::empty<u64>();
        let i = 0;
        while (i <= 36) {
            vector::push_back(&mut payouts, 350000); // 35:1 payout in basis points
            i = i + 1;
        };
        payouts
    }

    // Create color payouts (red, black, green)
    fun create_color_payouts(): vector<u64> {
        let payouts = vector::empty<u64>();
        vector::push_back(&mut payouts, 20000); // Red: 2:1 payout in basis points
        vector::push_back(&mut payouts, 20000); // Black: 2:1 payout in basis points
        vector::push_back(&mut payouts, 350000); // Green: 35:1 payout in basis points (single zero)
        payouts
    }

    // Create other bet type payouts (odd, even, high, low)
    fun create_other_payouts(): vector<u64> {
        let payouts = vector::empty<u64>();
        vector::push_back(&mut payouts, 20000); // Odd: 2:1 payout in basis points
        vector::push_back(&mut payouts, 20000); // Even: 2:1 payout in basis points
        vector::push_back(&mut payouts, 20000); // High (19-36): 2:1 payout in basis points
        vector::push_back(&mut payouts, 20000); // Low (1-18): 2:1 payout in basis points
        payouts
    }

    // Play roulette game entry function
    public entry fun play_roulette(
        treasury: &signer,
        player_address: address,
        bet_types: vector<String>,
        bet_values: vector<String>,
        bet_amounts: vector<u64>,
    ) acquires RouletteGameConfig {
        let treasury_addr = signer::address_of(treasury);
        assert!(exists<RouletteGameConfig>(treasury_addr), common::error_game_not_initialized());
        
        let config = borrow_global<RouletteGameConfig>(treasury_addr);
        
        // Basic validation
        assert!(
            common::validate_treasury_signer(treasury_addr, common::get_treasury_address(&config.base_config)),
            common::error_not_authorized()
        );
        assert!(!vector::is_empty(&bet_types), E_NO_BETS_PLACED);
        assert!(vector::length(&bet_types) == vector::length(&bet_values), common::error_invalid_parameters());
        assert!(vector::length(&bet_types) == vector::length(&bet_amounts), common::error_invalid_parameters());

        // Convert parameters to RouletteBet structs and calculate total bet amount
        let bets = vector::empty<RouletteBet>();
        let total_bet_amount = 0u64;
        let i = 0;
        while (i < vector::length(&bet_types)) {
            let bet_type = *vector::borrow(&bet_types, i);
            let bet_value = *vector::borrow(&bet_values, i);
            let bet_amount = *vector::borrow(&bet_amounts, i);
            
            // Validate bet type and value
            assert!(validate_bet_type_and_value(&bet_type, &bet_value), E_INVALID_BET_TYPE);
            
            let bet = RouletteBet {
                bet_type,
                bet_value,
                bet_amount,
            };
            vector::push_back(&mut bets, bet);
            total_bet_amount = total_bet_amount + bet_amount;
            i = i + 1;
        };

        assert!(
            common::validate_bet_amount(total_bet_amount, common::get_min_bet_amount(&config.base_config), common::get_max_bet_amount(&config.base_config)),
            common::error_invalid_bet_amount()
        );

        // Generate game ID and random seed
        let game_id = timestamp::now_microseconds();
        let random_seed = generate_random_seed(game_id, player_address);
        
        // Generate winning number (0-36)
        let winning_number = generate_roulette_number(random_seed);
        
        // Determine winning color and parity
        let winning_color = number_to_color(winning_number);
        let winning_parity = number_to_parity(winning_number);
        
        // Calculate total payout for all bets
        let total_payout = calculate_total_payout(&bets, winning_number, &winning_color, &winning_parity, config);
        
        // Apply house edge
        let final_payout = common::apply_house_edge(total_payout, common::get_house_edge(&config.base_config));
        
        let base_result = common::create_game_result_base(
            game_id,
            player_address,
            total_bet_amount,
            final_payout,
            random_seed,
            timestamp::now_seconds(),
        );

        let _result = RouletteGameResult {
            base_result,
            bets,
            winning_number,
            winning_color,
            winning_parity,
            total_payout: final_payout,
        };

        // Emit event with complete game result
        event::emit(RouletteGameResultEvent {
            game_id,
            player_address,
            bets,
            winning_number,
            winning_color,
            winning_parity,
            total_bet_amount,
            total_payout: final_payout,
            random_seed,
            timestamp: timestamp::now_seconds(),
        });
    }

    // Generate random seed using game ID and player address
    fun generate_random_seed(game_id: u64, player_address: address): u64 {
        use std::hash;
        use std::bcs;
        
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

    // Generate roulette number (0-36) from random seed
    fun generate_roulette_number(random_seed: u64): u8 {
        ((random_seed % 37) as u8)
    }

    // Map roulette number to color
    fun number_to_color(number: u8): String {
        if (number == 0) {
            std::string::utf8(b"green")
        } else {
            // Standard roulette color mapping
            // Red numbers: 1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
            let red_numbers = vector[1u8, 3u8, 5u8, 7u8, 9u8, 12u8, 14u8, 16u8, 18u8, 19u8, 21u8, 23u8, 25u8, 27u8, 30u8, 32u8, 34u8, 36u8];
            if (vector::contains(&red_numbers, &number)) {
                std::string::utf8(b"red")
            } else {
                std::string::utf8(b"black")
            }
        }
    }

    // Map roulette number to parity
    fun number_to_parity(number: u8): String {
        if (number == 0) {
            std::string::utf8(b"zero")
        } else if (number % 2 == 1) {
            std::string::utf8(b"odd")
        } else {
            std::string::utf8(b"even")
        }
    }

    // Validate bet type and value combination
    fun validate_bet_type_and_value(bet_type: &String, bet_value: &String): bool {
        let number_type = std::string::utf8(b"number");
        let color_type = std::string::utf8(b"color");
        let odd_type = std::string::utf8(b"odd");
        let even_type = std::string::utf8(b"even");
        let high_type = std::string::utf8(b"high");
        let low_type = std::string::utf8(b"low");
        
        if (bet_type == &number_type) {
            validate_number_bet_value(bet_value)
        } else if (bet_type == &color_type) {
            validate_color_bet_value(bet_value)
        } else if (bet_type == &odd_type || bet_type == &even_type || bet_type == &high_type || bet_type == &low_type) {
            // For these bet types, bet_value should match bet_type
            bet_value == bet_type
        } else {
            false
        }
    }

    // Validate number bet value (should be 0-36)
    fun validate_number_bet_value(bet_value: &String): bool {
        // Convert string to number and validate range
        let i = 0u8;
        while (i <= 36) {
            let num_str = number_to_string(i);
            if (bet_value == &num_str) {
                return true
            };
            i = i + 1;
        };
        false
    }

    // Validate color bet value (should be red, black, or green)
    fun validate_color_bet_value(bet_value: &String): bool {
        let red = std::string::utf8(b"red");
        let black = std::string::utf8(b"black");
        let green = std::string::utf8(b"green");
        
        bet_value == &red || bet_value == &black || bet_value == &green
    }

    // Convert number to string (helper function)
    fun number_to_string(num: u8): String {
        if (num == 0) { std::string::utf8(b"0") }
        else if (num == 1) { std::string::utf8(b"1") }
        else if (num == 2) { std::string::utf8(b"2") }
        else if (num == 3) { std::string::utf8(b"3") }
        else if (num == 4) { std::string::utf8(b"4") }
        else if (num == 5) { std::string::utf8(b"5") }
        else if (num == 6) { std::string::utf8(b"6") }
        else if (num == 7) { std::string::utf8(b"7") }
        else if (num == 8) { std::string::utf8(b"8") }
        else if (num == 9) { std::string::utf8(b"9") }
        else if (num == 10) { std::string::utf8(b"10") }
        else if (num == 11) { std::string::utf8(b"11") }
        else if (num == 12) { std::string::utf8(b"12") }
        else if (num == 13) { std::string::utf8(b"13") }
        else if (num == 14) { std::string::utf8(b"14") }
        else if (num == 15) { std::string::utf8(b"15") }
        else if (num == 16) { std::string::utf8(b"16") }
        else if (num == 17) { std::string::utf8(b"17") }
        else if (num == 18) { std::string::utf8(b"18") }
        else if (num == 19) { std::string::utf8(b"19") }
        else if (num == 20) { std::string::utf8(b"20") }
        else if (num == 21) { std::string::utf8(b"21") }
        else if (num == 22) { std::string::utf8(b"22") }
        else if (num == 23) { std::string::utf8(b"23") }
        else if (num == 24) { std::string::utf8(b"24") }
        else if (num == 25) { std::string::utf8(b"25") }
        else if (num == 26) { std::string::utf8(b"26") }
        else if (num == 27) { std::string::utf8(b"27") }
        else if (num == 28) { std::string::utf8(b"28") }
        else if (num == 29) { std::string::utf8(b"29") }
        else if (num == 30) { std::string::utf8(b"30") }
        else if (num == 31) { std::string::utf8(b"31") }
        else if (num == 32) { std::string::utf8(b"32") }
        else if (num == 33) { std::string::utf8(b"33") }
        else if (num == 34) { std::string::utf8(b"34") }
        else if (num == 35) { std::string::utf8(b"35") }
        else if (num == 36) { std::string::utf8(b"36") }
        else { std::string::utf8(b"0") } // fallback
    }

    // Calculate total payout for all bets
    fun calculate_total_payout(
        bets: &vector<RouletteBet>,
        winning_number: u8,
        winning_color: &String,
        winning_parity: &String,
        config: &RouletteGameConfig
    ): u64 {
        let total_payout = 0u64;
        let i = 0;
        
        while (i < vector::length(bets)) {
            let bet = vector::borrow(bets, i);
            let bet_payout = calculate_bet_payout(bet, winning_number, winning_color, winning_parity, config);
            total_payout = total_payout + bet_payout;
            i = i + 1;
        };
        
        total_payout
    }

    // Calculate payout for a single bet
    fun calculate_bet_payout(
        bet: &RouletteBet,
        winning_number: u8,
        winning_color: &String,
        winning_parity: &String,
        config: &RouletteGameConfig
    ): u64 {
        let number_type = std::string::utf8(b"number");
        let color_type = std::string::utf8(b"color");
        let odd_type = std::string::utf8(b"odd");
        let even_type = std::string::utf8(b"even");
        let high_type = std::string::utf8(b"high");
        let low_type = std::string::utf8(b"low");
        
        if (bet.bet_type == number_type) {
            // Number bet - check if bet_value matches winning number
            let winning_num_str = number_to_string(winning_number);
            if (bet.bet_value == winning_num_str) {
                let multiplier = *vector::borrow(&config.number_payouts, (winning_number as u64));
                common::calculate_payout(bet.bet_amount, multiplier)
            } else {
                0
            }
        } else if (bet.bet_type == color_type) {
            // Color bet - check if bet_value matches winning color
            if (&bet.bet_value == winning_color) {
                let multiplier = get_color_multiplier(&bet.bet_value, config);
                common::calculate_payout(bet.bet_amount, multiplier)
            } else {
                0
            }
        } else if (bet.bet_type == odd_type || bet.bet_type == even_type) {
            // Parity bet - check if bet_type matches winning parity
            if (&bet.bet_type == winning_parity) {
                let multiplier = *vector::borrow(&config.other_payouts, 0); // odd/even use index 0/1
                common::calculate_payout(bet.bet_amount, multiplier)
            } else {
                0
            }
        } else if (bet.bet_type == high_type) {
            // High bet (19-36)
            if (winning_number >= 19 && winning_number <= 36) {
                let multiplier = *vector::borrow(&config.other_payouts, 2); // high uses index 2
                common::calculate_payout(bet.bet_amount, multiplier)
            } else {
                0
            }
        } else if (bet.bet_type == low_type) {
            // Low bet (1-18)
            if (winning_number >= 1 && winning_number <= 18) {
                let multiplier = *vector::borrow(&config.other_payouts, 3); // low uses index 3
                common::calculate_payout(bet.bet_amount, multiplier)
            } else {
                0
            }
        } else {
            0 // Invalid bet type
        }
    }

    // Get color multiplier from config
    fun get_color_multiplier(color: &String, config: &RouletteGameConfig): u64 {
        let red = std::string::utf8(b"red");
        let black = std::string::utf8(b"black");
        let green = std::string::utf8(b"green");
        
        if (color == &red) {
            *vector::borrow(&config.color_payouts, 0)
        } else if (color == &black) {
            *vector::borrow(&config.color_payouts, 1)
        } else if (color == &green) {
            *vector::borrow(&config.color_payouts, 2)
        } else {
            0 // Invalid color
        }
    }

    // View functions
    #[view]
    public fun get_config(treasury_addr: address): (u64, u64, u64) acquires RouletteGameConfig {
        assert!(exists<RouletteGameConfig>(treasury_addr), common::error_game_not_initialized());
        let config = borrow_global<RouletteGameConfig>(treasury_addr);
        (
            common::get_min_bet_amount(&config.base_config),
            common::get_max_bet_amount(&config.base_config),
            common::get_house_edge(&config.base_config)
        )
    }

    #[view]
    public fun is_initialized(treasury_addr: address): bool {
        exists<RouletteGameConfig>(treasury_addr)
    }
}