module movement_casino::mines_game {
    use std::signer;
    use std::vector;
    use std::bcs;
    use aptos_framework::timestamp;
    use aptos_framework::event;

    use movement_casino::common;

    // Mines-specific error codes
    const E_INVALID_MINE_COUNT: u64 = 100;
    const E_INVALID_GRID_SIZE: u64 = 101;
    const E_INVALID_CELL_POSITION: u64 = 102;
    const E_CELL_ALREADY_REVEALED: u64 = 103;
    const E_MINE_HIT: u64 = 104;

    // Game configuration
    struct MinesGameConfig has key {
        base_config: common::GameConfig,
        max_mines: u8,
        grid_size: u8,
        multipliers: vector<u64>, // Multiplier table based on mine count and revealed cells
    }

    // Game result structure
    struct MinesGameResult has drop, store {
        base_result: common::GameResultBase,
        mine_count: u8,
        mine_positions: vector<u8>,
        revealed_cells: vector<u8>,
        hit_mine: bool,
        payout_multiplier: u64,
    }

    // Game result event
    #[event]
    struct MinesGameResultEvent has drop, store {
        game_id: u64,
        player_address: address,
        mine_count: u8,
        mine_positions: vector<u8>,
        revealed_cells: vector<u8>,
        hit_mine: bool,
        bet_amount: u64,
        final_payout: u64,
        payout_multiplier: u64,
        random_seed: u64,
        timestamp: u64,
    }

    // Initialize mines game configuration
    public entry fun initialize(
        treasury: &signer,
        max_mines: u8,
        grid_size: u8,
        min_bet_amount: u64,
        max_bet_amount: u64,
        house_edge: u64,
    ) {
        let treasury_addr = signer::address_of(treasury);
        assert!(!exists<MinesGameConfig>(treasury_addr), common::error_game_not_initialized());
        
        // Validate parameters
        assert!(max_mines > 0 && max_mines < grid_size * grid_size, E_INVALID_MINE_COUNT);
        assert!(grid_size > 0 && grid_size <= 10, E_INVALID_GRID_SIZE); // Reasonable grid size limit
        
        // Initialize multiplier table based on mine count and revealed cells
        let multipliers = create_multiplier_table(max_mines, grid_size);
        
        let base_config = common::create_game_config(
            treasury_addr,
            min_bet_amount,
            max_bet_amount,
            house_edge,
        );

        move_to(treasury, MinesGameConfig {
            base_config,
            max_mines,
            grid_size,
            multipliers,
        });
    }

    // Create multiplier table for different mine counts and revealed cells
    fun create_multiplier_table(max_mines: u8, grid_size: u8): vector<u64> {
        let multipliers = vector::empty<u64>();
        let total_cells = (grid_size as u64) * (grid_size as u64);
        
        // Create a simple multiplier table
        // For each mine count (1 to max_mines), calculate multipliers for each possible revealed cell count
        let mine_count = 1;
        while (mine_count <= max_mines) {
            let safe_cells = total_cells - (mine_count as u64);
            let revealed = 1;
            while (revealed <= safe_cells) {
                // Simple multiplier calculation: base multiplier increases with risk
                let risk_factor = (mine_count as u64) * 1000 + revealed * 100;
                let multiplier = 10000 + risk_factor; // Base 1x (10000 basis points) + risk
                vector::push_back(&mut multipliers, multiplier);
                revealed = revealed + 1;
            };
            mine_count = mine_count + 1;
        };
        
        multipliers
    }

    // Generate random mine positions
    fun generate_mine_positions(mine_count: u8, grid_size: u8, random_seed: u64): vector<u8> {
        let mine_positions = vector::empty<u8>();
        let total_cells = grid_size * grid_size;
        let seed = random_seed;
        
        let i = 0;
        while (i < mine_count) {
            // Generate a random position using simple linear congruential generator
            seed = (seed * 1103515245 + 12345) % 2147483648;
            let position = ((seed % (total_cells as u64)) as u8);
            
            // Ensure no duplicate positions
            if (!vector::contains(&mine_positions, &position)) {
                vector::push_back(&mut mine_positions, position);
                i = i + 1;
            };
        };
        
        mine_positions
    }

    // Validate cell position is within grid bounds
    fun validate_cell_position(position: u8, grid_size: u8): bool {
        position < grid_size * grid_size
    }

    // Check if a cell contains a mine
    fun is_mine_at_position(position: u8, mine_positions: &vector<u8>): bool {
        vector::contains(mine_positions, &position)
    }

    // Calculate multiplier based on mine count and revealed safe cells
    fun calculate_mines_multiplier(mine_count: u8, revealed_safe_cells: u8, _multipliers: &vector<u64>): u64 {
        // Simple lookup in multiplier table
        // This is a simplified version - in practice, you'd have a more sophisticated lookup
        let base_multiplier = 10000; // 1x in basis points
        let risk_bonus = (mine_count as u64) * 500 + (revealed_safe_cells as u64) * 200;
        base_multiplier + risk_bonus
    }

    // Play mines game entry function
    public entry fun play_mines(
        treasury: &signer,
        player_address: address,
        bet_amount: u64,
        mine_count: u8,
        revealed_cells: vector<u8>,
    ) acquires MinesGameConfig {
        let treasury_addr = signer::address_of(treasury);
        assert!(exists<MinesGameConfig>(treasury_addr), common::error_game_not_initialized());
        
        let config = borrow_global<MinesGameConfig>(treasury_addr);
        
        // Validate inputs
        assert!(
            common::validate_treasury_signer(treasury_addr, common::get_treasury_address(&config.base_config)),
            common::error_not_authorized()
        );
        assert!(
            common::validate_bet_amount(bet_amount, common::get_min_bet_amount(&config.base_config), common::get_max_bet_amount(&config.base_config)),
            common::error_invalid_bet_amount()
        );
        assert!(mine_count > 0 && mine_count <= config.max_mines, E_INVALID_MINE_COUNT);
        assert!(vector::length(&revealed_cells) > 0, E_INVALID_CELL_POSITION);

        // Generate game ID and random seed
        let game_id = timestamp::now_microseconds();
        let random_seed = generate_random_seed(game_id, player_address, bet_amount);
        
        // Generate mine positions using randomness
        let mine_positions = generate_mine_positions(mine_count, config.grid_size, random_seed);
        
        // Process revealed cells and check for mines
        let (hit_mine, safe_cells_revealed) = process_revealed_cells(&revealed_cells, &mine_positions, config.grid_size);
        
        // Calculate payout
        let (final_payout, payout_multiplier) = if (hit_mine) {
            (0, 0) // No payout if mine is hit
        } else {
            let multiplier = calculate_mines_multiplier(mine_count, safe_cells_revealed, &config.multipliers);
            let gross_payout = common::calculate_payout(bet_amount, multiplier);
            let net_payout = common::apply_house_edge(gross_payout, common::get_house_edge(&config.base_config));
            (net_payout, multiplier)
        };
        
        // Create game result
        let base_result = common::create_game_result_base(
            game_id,
            player_address,
            bet_amount,
            final_payout,
            random_seed,
            timestamp::now_seconds(),
        );

        let _result = MinesGameResult {
            base_result,
            mine_count,
            mine_positions,
            revealed_cells,
            hit_mine,
            payout_multiplier,
        };

        // Emit event (will be implemented in task 2.5)
        event::emit(MinesGameResultEvent {
            game_id,
            player_address,
            mine_count,
            mine_positions,
            revealed_cells,
            hit_mine,
            bet_amount,
            final_payout,
            payout_multiplier,
            random_seed,
            timestamp: timestamp::now_seconds(),
        });
    }

    // Generate a random seed based on game parameters
    fun generate_random_seed(game_id: u64, player_address: address, bet_amount: u64): u64 {
        // Combine multiple sources for better randomness
        let addr_bytes = bcs::to_bytes(&player_address);
        let addr_sum = 0u64;
        let i = 0;
        while (i < vector::length(&addr_bytes) && i < 8) {
            addr_sum = addr_sum + (*vector::borrow(&addr_bytes, i) as u64);
            i = i + 1;
        };
        
        // Simple combination of available entropy sources
        (game_id * 1103515245 + bet_amount * 12345 + addr_sum * 67890) % 2147483648
    }

    // Process revealed cells and check for mine hits
    fun process_revealed_cells(revealed_cells: &vector<u8>, mine_positions: &vector<u8>, grid_size: u8): (bool, u8) {
        let hit_mine = false;
        let safe_cells_count = 0u8;
        
        let i = 0;
        let len = vector::length(revealed_cells);
        
        while (i < len) {
            let cell_position = *vector::borrow(revealed_cells, i);
            
            // Validate cell position
            assert!(validate_cell_position(cell_position, grid_size), E_INVALID_CELL_POSITION);
            
            // Check if this cell contains a mine
            if (is_mine_at_position(cell_position, mine_positions)) {
                hit_mine = true;
                break // Stop processing if mine is hit
            } else {
                safe_cells_count = safe_cells_count + 1;
            };
            
            i = i + 1;
        };
        
        (hit_mine, safe_cells_count)
    }

    // View functions
    #[view]
    public fun get_config(treasury_addr: address): (u8, u8, u64, u64, u64) acquires MinesGameConfig {
        assert!(exists<MinesGameConfig>(treasury_addr), common::error_game_not_initialized());
        let config = borrow_global<MinesGameConfig>(treasury_addr);
        (
            config.max_mines,
            config.grid_size,
            common::get_min_bet_amount(&config.base_config),
            common::get_max_bet_amount(&config.base_config),
            common::get_house_edge(&config.base_config)
        )
    }

    #[view]
    public fun is_initialized(treasury_addr: address): bool {
        exists<MinesGameConfig>(treasury_addr)
    }
}