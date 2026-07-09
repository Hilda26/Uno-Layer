# v0.2.17
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import hashlib


class UnoLayer(gl.Contract):
    games: TreeMap[str, str]
    total_games: u256

    def __init__(self) -> None:
        self.games = TreeMap()
        self.total_games = u256(0)

    # -----------------------------------------------------------------------
    # Internal helpers
    # -----------------------------------------------------------------------

    def _caller(self) -> str:
        return str(gl.message.sender_address)

    def _get_game(self, game_id: str) -> dict:
        raw = self.games.get(game_id)

        if raw is None or raw == "":
            raise Exception(f"Game {game_id} does not exist")

        return json.loads(raw)

    def _save_game(self, game_id: str, state: dict) -> None:
        self.games[game_id] = json.dumps(state)

    def _require_active(self, state: dict) -> None:
        if state["status"] != "active":
            raise Exception(f"Game is not active. Current status: {state['status']}")

    def _require_player(self, state: dict, caller: str) -> None:
        if caller not in state["players"]:
            raise Exception("Caller is not a player in this game")

    def _require_current_player(self, state: dict, caller: str) -> None:
        players = state["players"]
        idx = int(state["current_turn_index"])

        if players[idx].lower() != caller.lower():
            raise Exception(f"Not your turn. Expected {players[idx]}, got {caller}")

    def _advance_turn(self, state: dict, skip: bool) -> dict:
        players = state["players"]
        n = len(players)
        direction = state["direction"]
        idx = int(state["current_turn_index"])

        step = 1
        if direction == "counterclockwise":
            step = -1

        next_idx = (idx + step) % n

        if skip:
            next_idx = (next_idx + step) % n

        state["current_turn_index"] = next_idx
        return state

    def _valid_colours(self) -> list:
        return ["red", "blue", "green", "yellow", "wild"]

    def _normal_colours(self) -> list:
        return ["red", "blue", "green", "yellow"]

    def _valid_kinds(self) -> list:
        return [
            "number",
            "flip_direction",
            "block_turn",
            "pull_two",
            "colour_shift",
            "power_shift",
        ]

    def _card_label(self, card: dict) -> str:
        if card.get("label") is not None:
            return str(card.get("label"))

        colour = str(card.get("colour"))
        kind = str(card.get("kind"))

        if kind == "number":
            return f"{colour}_{str(card.get('value'))}"

        return f"{colour}_{kind}"

    def _validate_card(self, card: dict) -> None:
        if card is None:
            raise Exception("Invalid card payload")

        if card.get("colour") not in self._valid_colours():
            raise Exception(f"Invalid card colour: {card.get('colour')}")

        if card.get("kind") not in self._valid_kinds():
            raise Exception(f"Invalid card kind: {card.get('kind')}")

        if card.get("kind") == "number":
            if card.get("value") is None:
                raise Exception("Number card requires a value")

            value = int(card.get("value"))
            if value < 0 or value > 9:
                raise Exception("Number card value must be between 0 and 9")

        if card.get("colour") == "wild":
            if card.get("kind") not in ["colour_shift", "power_shift"]:
                raise Exception("Wild cards must be colour_shift or power_shift")

    def _is_playable(self, card: dict, active_colour: str, active_discard: dict) -> bool:
        if card["colour"] == "wild":
            return True

        if card["colour"] == active_colour:
            return True

        if card["kind"] == "number" and active_discard["kind"] == "number":
            return int(card.get("value")) == int(active_discard.get("value"))

        if card["kind"] != "number" and active_discard["kind"] != "number":
            return card["kind"] == active_discard["kind"]

        return False

    def _safe_subtract_draw_pile(self, remaining: int, draw_count: int) -> int:
        if draw_count >= remaining:
            return 0

        return remaining - draw_count

    # -----------------------------------------------------------------------
    # Write functions
    # -----------------------------------------------------------------------

    @gl.public.write
    def create_game(self, game_id: str, max_players: u256, mode: str) -> str:
        if game_id == "":
            raise Exception("Game id cannot be empty")

        if self.games.get(game_id) is not None:
            raise Exception(f"Game {game_id} already exists")

        max_players_int = int(max_players)

        if max_players_int < 2:
            raise Exception("A game requires at least 2 players")

        if max_players_int > 10:
            raise Exception("Maximum players cannot exceed 10")

        if mode not in ["classic", "quick", "private", "ranked"]:
            raise Exception("Invalid mode")

        caller = self._caller()

        state = {
            "game_id": game_id,
            "creator": caller,
            "status": "waiting",
            "players": [caller],
            "max_players": max_players_int,
            "mode": mode,
            "current_turn_index": 0,
            "direction": "clockwise",
            "active_colour": "",
            "active_discard": None,
            "hand_counts": {caller: 0},
            "deck_commitment": "",
            "hand_commitments": {caller: ""},
            "draw_pile_remaining": 0,
            "move_count": 0,
            "last_move_id": "",
            "winner": "",
            "move_history": [],
            "move_records": {},
            "challenges": [],
            "layer_callers": [],
            "entry_fee_paid_by": [],
            "shuffle_seed_contributions": {},
            "deck_seed": "",
            "deck_entropy": "",
            "fair_play_results": {},
        }

        self._save_game(game_id, state)
        self.total_games = self.total_games + u256(1)

        return json.dumps({
            "status": "created",
            "game_id": game_id,
            "creator": caller,
        })

    @gl.public.write
    def join_game(self, game_id: str) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        if state["status"] != "waiting":
            raise Exception("Game is not accepting players")

        if caller in state["players"]:
            return json.dumps({
                "status": "already_joined",
                "seat": state["players"].index(caller),
            })

        if len(state["players"]) >= int(state["max_players"]):
            raise Exception("Game is full")

        state["players"].append(caller)
        state["hand_counts"][caller] = 0
        state["hand_commitments"][caller] = ""

        self._save_game(game_id, state)

        return json.dumps({
            "status": "joined",
            "game_id": game_id,
            "player": caller,
            "seat": len(state["players"]) - 1,
        })

    @gl.public.write
    def commit_deck(self, game_id: str, deck_commitment: str) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        if state["creator"].lower() != caller.lower():
            raise Exception("Only creator can commit deck")

        if state["status"] != "waiting":
            raise Exception("Deck can only be committed before the game starts")

        if deck_commitment == "":
            raise Exception("Deck commitment cannot be empty")

        state["deck_commitment"] = deck_commitment
        self._save_game(game_id, state)

        return json.dumps({
            "status": "deck_committed",
            "game_id": game_id,
        })

    @gl.public.write
    def commit_hand(
        self,
        game_id: str,
        player: Address,
        hand_commitment: str,
        hand_count: u256,
    ) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        if state["creator"].lower() != caller.lower():
            raise Exception("Only creator can commit hands during setup")

        if state["status"] != "waiting":
            raise Exception("Hands can only be committed before the game starts")

        player_str = str(player)

        if player_str not in state["players"]:
            raise Exception("Cannot commit hand for a non-player")

        if hand_commitment == "":
            raise Exception("Hand commitment cannot be empty")

        hand_count_int = int(hand_count)

        if hand_count_int < 0:
            raise Exception("Hand count cannot be negative")

        state["hand_commitments"][player_str] = hand_commitment
        state["hand_counts"][player_str] = hand_count_int

        self._save_game(game_id, state)

        return json.dumps({
            "status": "hand_committed",
            "game_id": game_id,
            "player": player_str,
            "hand_count": hand_count_int,
        })

    @gl.public.write
    def pay_entry_fee(self, game_id: str, amount: str) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        self._require_player(state, caller)

        if state["status"] != "waiting":
            raise Exception("Entry fee can only be paid before the game starts")

        if amount == "":
            raise Exception("Entry fee amount cannot be empty")

        if caller not in state["entry_fee_paid_by"]:
            state["entry_fee_paid_by"].append(caller)

        self._save_game(game_id, state)

        return json.dumps({
            "status": "entry_fee_recorded",
            "game_id": game_id,
            "player": caller,
            "amount": amount,
            "paid_count": len(state["entry_fee_paid_by"]),
        })

    @gl.public.write
    def submit_shuffle_seed(self, game_id: str, contribution: str) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        self._require_player(state, caller)

        if state["status"] != "waiting":
            raise Exception("Shuffle seed contributions can only be submitted before the game starts")

        if contribution == "":
            raise Exception("Shuffle seed contribution cannot be empty")

        if state["deck_seed"] != "":
            raise Exception("Deck seed has already been generated for this game")

        state["shuffle_seed_contributions"][caller] = contribution
        self._save_game(game_id, state)

        return json.dumps({
            "status": "seed_submitted",
            "game_id": game_id,
            "player": caller,
            "submitted": len(state["shuffle_seed_contributions"]),
            "needed": len(state["players"]),
        })

    @gl.public.write
    def request_shuffle_seed(self, game_id: str) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        if state["creator"].lower() != caller.lower():
            raise Exception("Only creator can request the consensus shuffle seed")

        if state["status"] != "waiting":
            raise Exception("Shuffle seed can only be requested before the game starts")

        if state["deck_seed"] != "":
            return json.dumps({
                "status": "already_generated",
                "game_id": game_id,
                "deck_seed": state["deck_seed"],
                "deck_entropy": state["deck_entropy"],
            })

        missing = []
        for player in state["players"]:
            if state["shuffle_seed_contributions"].get(player, "") == "":
                missing.append(player)

        if len(missing) > 0:
            raise Exception(
                "All players must submit a shuffle seed contribution first. Missing: "
                + ", ".join(missing)
            )

        # Non-deterministic external entropy: every validator fetches the same
        # public randomness beacon at consensus time. The result cannot be
        # predicted ahead of time, but validators reach strict consensus
        # because they observe the same external resource.
        def get_entropy() -> str:
            result = gl.nondet.web.render(
                "https://drand.cloudflare.com/public/latest", mode="text"
            )
            return result

        entropy = gl.eq_principle.strict_eq(get_entropy)

        contributions_json = json.dumps(state["shuffle_seed_contributions"], sort_keys=True)
        combined = game_id + "|" + contributions_json + "|" + str(entropy)
        deck_seed = hashlib.sha256(combined.encode()).hexdigest()

        state["deck_seed"] = deck_seed
        state["deck_entropy"] = str(entropy)
        self._save_game(game_id, state)

        return json.dumps({
            "status": "seed_generated",
            "game_id": game_id,
            "deck_seed": deck_seed,
        })

    @gl.public.write
    def start_game(self, game_id: str, first_discard_json: str, active_colour: str) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        if state["creator"].lower() != caller.lower():
            raise Exception("Only creator can start the game")

        if state["status"] != "waiting":
            raise Exception("Game is not in waiting state")

        if len(state["players"]) < 2:
            raise Exception("Need at least 2 players")

        if state["deck_commitment"] == "":
            raise Exception("Deck commitment is required before starting")

        if state["deck_seed"] == "":
            raise Exception("Consensus shuffle seed is required before starting")

        if state["creator"] not in state.get("entry_fee_paid_by", []):
            raise Exception("Creator must pay the entry fee before starting")

        if active_colour not in self._normal_colours():
            raise Exception(f"Invalid active colour: {active_colour}")

        first_discard = json.loads(first_discard_json)
        self._validate_card(first_discard)

        if first_discard["colour"] == "wild":
            raise Exception("First discard cannot be a wild card")

        missing_hands = []

        for player in state["players"]:
            if state["hand_commitments"].get(player, "") == "":
                missing_hands.append(player)

        if len(missing_hands) > 0:
            raise Exception("All player hands must be committed before starting")

        state["status"] = "active"
        state["active_discard"] = first_discard
        state["active_colour"] = active_colour
        state["current_turn_index"] = 0

        total_cards = 108
        dealt_cards = len(state["players"]) * 7
        state["draw_pile_remaining"] = total_cards - dealt_cards - 1

        if state["draw_pile_remaining"] < 0:
            state["draw_pile_remaining"] = 0

        self._save_game(game_id, state)

        return json.dumps({
            "status": "started",
            "game_id": game_id,
            "first_player": state["players"][0],
            "active_colour": active_colour,
            "first_discard": first_discard,
            "deck_seed": state["deck_seed"],
        })

    @gl.public.write
    def submit_card(
        self,
        game_id: str,
        card_json: str,
        declared_colour: str,
        hand_commitment_after: str,
        hand_count_after: u256,
    ) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        self._require_active(state)
        self._require_player(state, caller)
        self._require_current_player(state, caller)

        card = json.loads(card_json)
        self._validate_card(card)

        if hand_commitment_after == "":
            raise Exception("New hand commitment cannot be empty")

        active_colour = state["active_colour"]
        active_discard = state["active_discard"]

        if active_discard is None:
            raise Exception("Active discard is not set")

        if not self._is_playable(card, active_colour, active_discard):
            raise Exception(
                f"Card {self._card_label(card)} is not playable against "
                f"active colour={active_colour}, discard={self._card_label(active_discard)}"
            )

        new_active_colour = active_colour

        if card["colour"] == "wild":
            if declared_colour not in self._normal_colours():
                raise Exception(f"Wild card requires a valid declared colour, got: {declared_colour}")

            new_active_colour = declared_colour
        else:
            new_active_colour = card["colour"]

            if declared_colour != "" and declared_colour != card["colour"]:
                raise Exception("Declared colour can only change when playing a wild card")

        prev_count = int(state["hand_counts"].get(caller, 0))

        if prev_count <= 0:
            raise Exception("Player has no cards to play")

        expected_after = prev_count - 1
        hand_count_after_int = int(hand_count_after)

        if hand_count_after_int != expected_after:
            raise Exception(
                f"Hand count mismatch: expected {expected_after}, got {hand_count_after_int}"
            )

        players = state["players"]
        n = len(players)
        direction = state["direction"]
        idx = int(state["current_turn_index"])

        skip_next = False
        draw_penalty = 0
        new_direction = direction

        if card["kind"] == "flip_direction":
            if n > 2:
                if direction == "clockwise":
                    new_direction = "counterclockwise"
                else:
                    new_direction = "clockwise"

        elif card["kind"] == "block_turn":
            skip_next = True

        elif card["kind"] == "pull_two":
            skip_next = True
            draw_penalty = 2

        # Power Shift no longer applies a hardcoded skip/draw penalty here.
        # Its effect is chosen afterwards by GenLayer consensus via
        # resolve_power_shift(), which picks one of several outcomes based
        # on the live game state (see that method for details).

        state["direction"] = new_direction

        if card["kind"] == "flip_direction" and n == 2:
            next_idx = idx
        else:
            step = 1
            if new_direction == "counterclockwise":
                step = -1

            next_idx = (idx + step) % n

            if skip_next:
                skipped_player = players[next_idx]

                if draw_penalty > 0:
                    state["hand_counts"][skipped_player] = int(
                        state["hand_counts"].get(skipped_player, 0)
                    ) + draw_penalty

                    state["draw_pile_remaining"] = self._safe_subtract_draw_pile(
                        int(state["draw_pile_remaining"]),
                        draw_penalty,
                    )

                next_idx = (next_idx + step) % n

        state["active_discard"] = card
        state["active_colour"] = new_active_colour
        state["hand_counts"][caller] = hand_count_after_int
        state["hand_commitments"][caller] = hand_commitment_after

        state["move_count"] = int(state["move_count"]) + 1
        move_id = "move_" + str(state["move_count"])

        move_record = {
            "id": move_id,
            "player": caller,
            "card": card,
            "declared_colour": declared_colour,
            "old_active_colour": active_colour,
            "new_active_colour": new_active_colour,
            "old_direction": direction,
            "new_direction": new_direction,
            "action_effect": card["kind"] if card["kind"] != "number" else "",
            "next_player": players[next_idx],
            "hand_count_after": hand_count_after_int,
            "draw_penalty": draw_penalty,
        }

        state["move_history"].append(move_id)
        state["move_records"][move_id] = move_record
        state["last_move_id"] = move_id

        if hand_count_after_int == 0:
            state["status"] = "completed"
            state["winner"] = caller
            state["current_turn_index"] = idx

            self._save_game(game_id, state)

            return json.dumps({
                "accepted": True,
                "status": "completed",
                "action": card["kind"],
                "winner": caller,
                "move_id": move_id,
                "reasoning": f"Player {caller} played their last card and won the game.",
            })

        state["current_turn_index"] = next_idx

        self._save_game(game_id, state)

        return json.dumps({
            "accepted": True,
            "status": "active",
            "action": card["kind"],
            "old_direction": direction,
            "new_direction": new_direction,
            "active_colour": new_active_colour,
            "next_turn": players[next_idx],
            "draw_penalty": draw_penalty,
            "move_id": move_id,
            "reasoning": (
                f"Card {self._card_label(card)} is valid against active colour={active_colour}. "
                f"Direction={new_direction}. Next player={players[next_idx]}."
            ),
        })

    @gl.public.write
    def record_draw(
        self,
        game_id: str,
        draw_count: u256,
        hand_commitment_after: str,
        hand_count_after: u256,
        deck_commitment_after: str,
    ) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        self._require_active(state)
        self._require_player(state, caller)
        self._require_current_player(state, caller)

        draw_count_int = int(draw_count)

        if draw_count_int <= 0:
            raise Exception("Draw count must be greater than zero")

        if hand_commitment_after == "":
            raise Exception("New hand commitment cannot be empty")

        if deck_commitment_after == "":
            raise Exception("New deck commitment cannot be empty")

        prev_count = int(state["hand_counts"].get(caller, 0))
        hand_count_after_int = int(hand_count_after)

        if hand_count_after_int != prev_count + draw_count_int:
            raise Exception(
                f"Draw count mismatch: expected {prev_count + draw_count_int}, got {hand_count_after_int}"
            )

        state["hand_counts"][caller] = hand_count_after_int
        state["hand_commitments"][caller] = hand_commitment_after
        state["deck_commitment"] = deck_commitment_after
        state["draw_pile_remaining"] = self._safe_subtract_draw_pile(
            int(state["draw_pile_remaining"]),
            draw_count_int,
        )

        self._save_game(game_id, state)

        return json.dumps({
            "status": "draw_recorded",
            "game_id": game_id,
            "player": caller,
            "count": draw_count_int,
            "hand_count_after": hand_count_after_int,
        })

    @gl.public.write
    def pass_turn(self, game_id: str) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        self._require_active(state)
        self._require_player(state, caller)
        self._require_current_player(state, caller)

        state = self._advance_turn(state, False)
        self._save_game(game_id, state)

        return json.dumps({
            "status": "passed",
            "game_id": game_id,
            "player": caller,
            "next_turn": state["players"][int(state["current_turn_index"])],
        })

    @gl.public.write
    def call_layer(self, game_id: str) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        self._require_active(state)
        self._require_player(state, caller)

        count = int(state["hand_counts"].get(caller, 0))

        if count != 1:
            raise Exception(f"Can only call Layer with exactly 1 card. You have {count}")

        if caller not in state["layer_callers"]:
            state["layer_callers"].append(caller)

        self._save_game(game_id, state)

        return json.dumps({
            "status": "layer_called",
            "game_id": game_id,
            "player": caller,
        })

    @gl.public.write
    def challenge_move(self, game_id: str, move_number: u256, reason: str) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        self._require_player(state, caller)

        if state["status"] not in ["active", "completed"]:
            raise Exception("Cannot challenge in current game state")

        move_number_int = int(move_number)

        if move_number_int <= 0 or move_number_int > int(state["move_count"]):
            raise Exception("Invalid move number")

        if reason == "":
            raise Exception("Challenge reason cannot be empty")

        challenge_id = "challenge_" + str(len(state["challenges"]) + 1)

        challenge = {
            "id": challenge_id,
            "challenger": caller,
            "move_number": move_number_int,
            "reason": reason,
            "status": "pending",
            "resolution": "",
        }

        state["challenges"].append(challenge)
        self._save_game(game_id, state)

        return json.dumps({
            "status": "challenge_recorded",
            "game_id": game_id,
            "challenge_id": challenge_id,
        })

    @gl.public.write
    def resolve_challenge(self, game_id: str, challenge_id: str) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        self._require_player(state, caller)

        challenge = None

        for ch in state["challenges"]:
            if ch["id"] == challenge_id:
                challenge = ch
                break

        if challenge is None:
            raise Exception("Challenge not found")

        if challenge["status"] != "pending":
            raise Exception("Challenge has already been resolved")

        move_id = "move_" + str(challenge["move_number"])
        move = state["move_records"].get(move_id)

        if move is None:
            raise Exception("Challenged move not found")

        prompt = (
            "You are the impartial AI referee for a UNO-style card game called UNO-LAYER.\n"
            f"A player challenged move #{challenge['move_number']} for this reason: "
            f"\"{challenge['reason']}\".\n"
            f"Move record (JSON): {json.dumps(move)}\n\n"
            "Rules: a card may be played if it matches the active colour, matches the "
            "discard's number/action kind, or is a wild card (colour_shift / power_shift). "
            "The 'old_active_colour' field is the colour that was active before this move.\n\n"
            "Decide whether the move described was VALID under these rules.\n"
            "Respond with EXACTLY one lowercase word and nothing else: "
            "valid_move, invalid_move, or unclear."
        )

        def get_verdict() -> str:
            result = gl.nondet.exec_prompt(prompt)
            return result.strip().lower()

        verdict = gl.eq_principle.prompt_comparative(
            get_verdict,
            "The result must be exactly one of: valid_move, invalid_move, unclear.",
        )

        verdict = str(verdict).strip().lower()

        if verdict not in ["valid_move", "invalid_move", "unclear"]:
            verdict = "unclear"

        challenge["status"] = "resolved"
        challenge["resolution"] = verdict
        penalty_player = ""

        if verdict == "invalid_move":
            penalty_player = move["player"]
            state["hand_counts"][penalty_player] = int(
                state["hand_counts"].get(penalty_player, 0)
            ) + 2
        elif verdict == "valid_move":
            penalty_player = challenge["challenger"]
            state["hand_counts"][penalty_player] = int(
                state["hand_counts"].get(penalty_player, 0)
            ) + 2

        challenge["penalty_player"] = penalty_player

        self._save_game(game_id, state)

        return json.dumps({
            "status": "resolved",
            "game_id": game_id,
            "challenge_id": challenge_id,
            "verdict": verdict,
            "penalty_player": penalty_player,
            "reasoning": (
                f"GenLayer consensus reviewed move #{challenge['move_number']} "
                f"and returned verdict '{verdict}'."
            ),
        })

    @gl.public.write
    def resolve_power_shift(self, game_id: str, move_number: u256) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        self._require_player(state, caller)

        move_number_int = int(move_number)
        move_id = "move_" + str(move_number_int)
        move = state["move_records"].get(move_id)

        if move is None:
            raise Exception("Move not found")

        if move["card"]["kind"] != "power_shift":
            raise Exception("Move is not a Power Shift play")

        if move.get("power_shift_effect", "") != "":
            raise Exception("Power Shift effect has already been resolved")

        hand_counts = state["hand_counts"]
        players = state["players"]

        prompt = (
            "You are resolving a 'Power Shift' wild card in the UNO-style game UNO-LAYER.\n"
            f"Players and current hand sizes (JSON): {json.dumps(hand_counts)}\n"
            f"Turn direction: {state['direction']}. "
            f"Active colour before this play: {move['old_active_colour']}.\n\n"
            "Choose exactly ONE effect from this list, considering hand sizes for balance:\n"
            "- draw_two_strongest: the player with the FEWEST cards draws 2 penalty cards\n"
            "- discard_one_weakest: the player with the MOST cards may discard 1 card\n"
            "- reverse_direction: reverse the turn direction\n"
            "- skip_next: the next player in turn order loses their turn\n\n"
            "Respond with EXACTLY one lowercase token and nothing else: "
            "draw_two_strongest, discard_one_weakest, reverse_direction, or skip_next."
        )

        def get_effect() -> str:
            result = gl.nondet.exec_prompt(prompt)
            return result.strip().lower()

        effect = gl.eq_principle.prompt_comparative(
            get_effect,
            "The result must be exactly one of: draw_two_strongest, discard_one_weakest, "
            "reverse_direction, skip_next.",
        )

        effect = str(effect).strip().lower()
        valid_effects = [
            "draw_two_strongest",
            "discard_one_weakest",
            "reverse_direction",
            "skip_next",
        ]

        if effect not in valid_effects:
            effect = "skip_next"

        target_player = ""

        if effect == "draw_two_strongest":
            target_player = min(players, key=lambda p: int(hand_counts.get(p, 0)))
            hand_counts[target_player] = int(hand_counts.get(target_player, 0)) + 2
            state["draw_pile_remaining"] = self._safe_subtract_draw_pile(
                int(state["draw_pile_remaining"]), 2
            )
        elif effect == "discard_one_weakest":
            target_player = max(players, key=lambda p: int(hand_counts.get(p, 0)))
        elif effect == "reverse_direction":
            state["direction"] = (
                "counterclockwise" if state["direction"] == "clockwise" else "clockwise"
            )
        elif effect == "skip_next":
            state = self._advance_turn(state, True)

        move["power_shift_effect"] = effect
        move["power_shift_target"] = target_player
        state["move_records"][move_id] = move

        self._save_game(game_id, state)

        return json.dumps({
            "status": "power_shift_resolved",
            "game_id": game_id,
            "move_id": move_id,
            "effect": effect,
            "target_player": target_player,
            "reasoning": f"GenLayer consensus chose effect '{effect}' for Power Shift move #{move_number_int}.",
        })

    @gl.public.write
    def judge_fair_play(self, game_id: str) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        self._require_player(state, caller)

        if state["status"] != "completed":
            raise Exception("Game must be completed before fair play can be judged")

        if state.get("fair_play_results"):
            return json.dumps({
                "status": "already_judged",
                "game_id": game_id,
                "results": state["fair_play_results"],
            })

        summary = {
            "players": state["players"],
            "winner": state["winner"],
            "move_count": state["move_count"],
            "challenges": state["challenges"],
            "layer_callers": state["layer_callers"],
            "final_hand_counts": state["hand_counts"],
            "final_status": state["status"],
        }

        prompt = (
            "You are the post-game fair-play judge for the UNO-style game UNO-LAYER.\n"
            f"Game summary (JSON): {json.dumps(summary)}\n\n"
            "For each player address in 'players', decide a fair-play SCORE ADJUSTMENT "
            "integer between -10 and +5 (inclusive), based on signs of: suspicious or "
            "repeated failed challenges, rage-quitting/forfeiting, stalling, or other "
            "abnormal play patterns. A player with no issues gets 0.\n\n"
            "Respond with ONLY a single JSON object mapping each player address (as given) "
            "to an integer adjustment, e.g. {\"0xabc\": 0, \"0xdef\": -5}. No other text."
        )

        def get_adjustments() -> str:
            result = gl.nondet.exec_prompt(prompt)
            return result.strip()

        raw = gl.eq_principle.prompt_comparative(
            get_adjustments,
            "The result must be a single JSON object mapping each player address to an "
            "integer between -10 and 5.",
        )

        try:
            adjustments = json.loads(str(raw))
        except Exception:
            adjustments = {}

        results = {}

        for player in state["players"]:
            adj = adjustments.get(player, 0) if isinstance(adjustments, dict) else 0

            try:
                adj_int = int(adj)
            except Exception:
                adj_int = 0

            if adj_int > 5:
                adj_int = 5

            if adj_int < -10:
                adj_int = -10

            results[player] = adj_int

        state["fair_play_results"] = results
        self._save_game(game_id, state)

        return json.dumps({
            "status": "judged",
            "game_id": game_id,
            "results": results,
        })

    @gl.public.write
    def forfeit_game(self, game_id: str) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        self._require_active(state)
        self._require_player(state, caller)

        state["status"] = "cancelled"

        remaining_players = []

        for player in state["players"]:
            if player.lower() != caller.lower():
                remaining_players.append(player)

        if len(remaining_players) == 1:
            state["status"] = "completed"
            state["winner"] = remaining_players[0]

        self._save_game(game_id, state)

        return json.dumps({
            "status": "forfeited",
            "game_id": game_id,
            "player": caller,
            "winner": state["winner"],
        })

    @gl.public.write
    def end_game(self, game_id: str, final_commitment: str) -> str:
        state = self._get_game(game_id)
        caller = self._caller()

        if state["winner"] == "":
            if state["creator"].lower() != caller.lower():
                raise Exception("Only creator can end a game without a winner")
        else:
            if state["winner"].lower() != caller.lower() and state["creator"].lower() != caller.lower():
                raise Exception("Only winner or creator can end the game")

        if final_commitment == "":
            raise Exception("Final commitment cannot be empty")

        state["status"] = "completed"
        state["deck_commitment"] = final_commitment

        self._save_game(game_id, state)

        return json.dumps({
            "status": "ended",
            "game_id": game_id,
            "winner": state["winner"],
        })

    # -----------------------------------------------------------------------
    # View functions
    # -----------------------------------------------------------------------

    @gl.public.view
    def get_game(self, game_id: str) -> str:
        raw = self.games.get(game_id)

        if raw is None:
            return json.dumps({"error": "not found"})

        return raw

    @gl.public.view
    def get_total_games(self) -> str:
        return json.dumps({
            "total_games": int(self.total_games),
        })

    @gl.public.view
    def get_players(self, game_id: str) -> str:
        state = self._get_game(game_id)
        return json.dumps(state["players"])

    @gl.public.view
    def get_current_turn(self, game_id: str) -> str:
        state = self._get_game(game_id)
        idx = int(state["current_turn_index"])

        return json.dumps({
            "player": state["players"][idx],
            "index": idx,
        })

    @gl.public.view
    def get_active_discard(self, game_id: str) -> str:
        state = self._get_game(game_id)

        return json.dumps({
            "active_discard": state["active_discard"],
        })

    @gl.public.view
    def get_active_colour(self, game_id: str) -> str:
        state = self._get_game(game_id)

        return json.dumps({
            "active_colour": state["active_colour"],
        })

    @gl.public.view
    def get_direction(self, game_id: str) -> str:
        state = self._get_game(game_id)

        return json.dumps({
            "direction": state["direction"],
        })

    @gl.public.view
    def get_hand_counts(self, game_id: str) -> str:
        state = self._get_game(game_id)
        return json.dumps(state["hand_counts"])

    @gl.public.view
    def get_move_history(self, game_id: str) -> str:
        state = self._get_game(game_id)
        return json.dumps(state["move_history"])

    @gl.public.view
    def get_move(self, game_id: str, move_id: str) -> str:
        state = self._get_game(game_id)

        if move_id not in state["move_records"]:
            return json.dumps({"error": "move not found"})

        return json.dumps(state["move_records"][move_id])

    @gl.public.view
    def get_last_move(self, game_id: str) -> str:
        state = self._get_game(game_id)
        move_id = state["last_move_id"]

        if move_id == "":
            return json.dumps({
                "last_move_id": "",
                "move": None,
            })

        return json.dumps({
            "last_move_id": move_id,
            "move": state["move_records"].get(move_id),
        })

    @gl.public.view
    def get_challenges(self, game_id: str) -> str:
        state = self._get_game(game_id)
        return json.dumps(state["challenges"])

    @gl.public.view
    def get_layer_callers(self, game_id: str) -> str:
        state = self._get_game(game_id)
        return json.dumps(state["layer_callers"])

    @gl.public.view
    def get_deck_seed(self, game_id: str) -> str:
        state = self._get_game(game_id)

        return json.dumps({
            "deck_seed": state.get("deck_seed", ""),
            "deck_entropy": state.get("deck_entropy", ""),
            "contributions": state.get("shuffle_seed_contributions", {}),
        })

    @gl.public.view
    def get_fair_play_results(self, game_id: str) -> str:
        state = self._get_game(game_id)
        return json.dumps(state.get("fair_play_results", {}))

    @gl.public.view
    def get_winner(self, game_id: str) -> str:
        state = self._get_game(game_id)

        return json.dumps({
            "winner": state["winner"],
            "status": state["status"],
        })
