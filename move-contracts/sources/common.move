module movement_casino::common {

    // Common error codes for all game contracts
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INVALID_PARAMETERS: u64 = 2;
    const E_INSUFFICIENT_BALANCE: u64 = 3;
    const E_GAME_NOT_INITIALIZED: u64 = 4;
    const E_INVALID_BET_AMOUNT: u64 = 5;
    const E_RANDOMNESS_FAILURE: u64 = 6;
    const E_INVALID_GAME_STATE: u64 = 7;
    const E_PAYOUT_CALCULATION_ERROR: u64 = 8;

    // Game type constants
    const GAME_MINES: u8 = 1;
    const GAME_WHEEL: u8 = 2;
    const GAME_PLINKO: u8 = 3;
    const GAME_ROULETTE: u8 = 4;

    // Common structs for game results
    struct GameResultBase has drop, store {
        game_id: u64,
        player_address: address,
        bet_amount: u64,
        final_payout: u64,
        random_seed: u64,
        timestamp: u64,
    }

    // Common interface for game configuration
    struct GameConfig has key, store {
        is_initialized: bool,
        treasury_address: address,
        min_bet_amount: u64,
        max_bet_amount: u64,
        house_edge: u64, // Basis points (e.g., 200 = 2%)
    }

    // Public functions to create and access GameConfig
    public fun create_game_config(
        treasury_address: address,
        min_bet_amount: u64,
        max_bet_amount: u64,
        house_edge: u64,
    ): GameConfig {
        GameConfig {
            is_initialized: true,
            treasury_address,
            min_bet_amount,
            max_bet_amount,
            house_edge,
        }
    }

    public fun get_treasury_address(config: &GameConfig): address {
        config.treasury_address
    }

    public fun get_min_bet_amount(config: &GameConfig): u64 {
        config.min_bet_amount
    }

    public fun get_max_bet_amount(config: &GameConfig): u64 {
        config.max_bet_amount
    }

    public fun get_house_edge(config: &GameConfig): u64 {
        config.house_edge
    }

    // Public functions to create GameResultBase
    public fun create_game_result_base(
        game_id: u64,
        player_address: address,
        bet_amount: u64,
        final_payout: u64,
        random_seed: u64,
        timestamp: u64,
    ): GameResultBase {
        GameResultBase {
            game_id,
            player_address,
            bet_amount,
            final_payout,
            random_seed,
            timestamp,
        }
    }

    // Error code getters
    public fun error_not_authorized(): u64 { E_NOT_AUTHORIZED }
    public fun error_invalid_parameters(): u64 { E_INVALID_PARAMETERS }
    public fun error_insufficient_balance(): u64 { E_INSUFFICIENT_BALANCE }
    public fun error_game_not_initialized(): u64 { E_GAME_NOT_INITIALIZED }
    public fun error_invalid_bet_amount(): u64 { E_INVALID_BET_AMOUNT }
    public fun error_randomness_failure(): u64 { E_RANDOMNESS_FAILURE }
    public fun error_invalid_game_state(): u64 { E_INVALID_GAME_STATE }
    public fun error_payout_calculation_error(): u64 { E_PAYOUT_CALCULATION_ERROR }

    // Game type getters
    public fun game_type_mines(): u8 { GAME_MINES }
    public fun game_type_wheel(): u8 { GAME_WHEEL }
    public fun game_type_plinko(): u8 { GAME_PLINKO }
    public fun game_type_roulette(): u8 { GAME_ROULETTE }

    // Common validation functions
    public fun validate_bet_amount(amount: u64, min_bet: u64, max_bet: u64): bool {
        amount >= min_bet && amount <= max_bet
    }

    public fun validate_treasury_signer(signer_addr: address, treasury_addr: address): bool {
        signer_addr == treasury_addr
    }

    // Common payout calculation helpers
    public fun calculate_payout(bet_amount: u64, multiplier: u64): u64 {
        (bet_amount * multiplier) / 10000 // Multiplier in basis points
    }

    public fun apply_house_edge(payout: u64, house_edge: u64): u64 {
        let edge_amount = (payout * house_edge) / 10000;
        if (payout > edge_amount) {
            payout - edge_amount
        } else {
            0
        }
    }
}