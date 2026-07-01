import pygame
import sys
import random
import logging
import os
import math
import functools
from enum import Enum, auto
from dataclasses import dataclass

# --- Arabic Support Packages ---
try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    HAS_ARABIC = True
except ImportError:
    HAS_ARABIC = False
    print("WARNING: Please install arabic packages -> pip install arabic-reshaper python-bidi")

@functools.lru_cache(maxsize=1000)
def get_arabic_text(text_str):
    if HAS_ARABIC:
        reshaped_text = arabic_reshaper.reshape(text_str)
        return get_display(reshaped_text)
    return text_str

def render_arabic(font, text, color):
    text_str = str(text)
    bidi_text = get_arabic_text(text_str)
    return font.render(bidi_text, True, color)

# ==========================================
# 1. LOGGING & SYSTEM SETUP
# ==========================================
logging.basicConfig(filename='game_debug.log', level=logging.INFO, format='%(asctime)s - [%(levelname)s] - %(message)s')

SCREEN_WIDTH = 540
SCREEN_HEIGHT = 960

C_BG_DARK = (28, 30, 38) 
C_BTN_GRAY = (180, 180, 180)
C_BTN_TEXT = (40, 40, 40)
C_CYAN_GLOW = (6, 182, 212)
C_WHITE = (255, 255, 255)
C_AVATAR_BG = (30, 41, 59)
C_TIMER_HUMAN = (46, 204, 113)
C_TIMER_BOT = (231, 76, 60)
C_MODAL_BG = (240, 240, 245)
C_DEALER_BADGE = (234, 179, 8)
C_PROJECT_BG = (80, 40, 100)
C_GOLD = (255, 215, 0)
C_GEM = (236, 72, 153)
C_DANGER = (239, 68, 68)

CHAT_PHRASES = [
    "كفوك الطيب", "كفو خوي!", "فنااان", "وعليكم السلام", "السلام عليكم",
    "تسلم خوي", "تسلم ليا", "طرا", "فدا", "كبوت!",
    "ابشر بالعوض", "سموحة", "صحصح خوي", "حرام عليك", "بسرعة!!",
    "يا ساتر", "ما قصرت", "ارحب", "طيار!!", "بطل!"
]

PROJECT_PHRASES = ["سرا", "خمسين", "مية", "أربعمية"]
RANKS = ["مبتدئ", "Expert", "متقدم", "محترف", "خبير", "نابغة"]

SUIT_SORT_ORDER = {'CLUBS': 0, 'HEARTS': 1, 'SPADES': 2, 'DIAMONDS': 3}

QAID_REASONS = {
    'SUN': ["سوا خاطئ", "قاطع"],
    'HAKAM': ["سوا خاطئ", "قاطع", "ما كبر بحكم", "ربع في المقفل"]
}

# ==========================================
# 2. ENUMS & DATACLASSES
# ==========================================
class AppState(Enum):
    MAIN_MENU = auto(); PROFILE = auto(); SHOP = auto(); IN_GAME = auto()

class Suit(Enum):
    HEARTS = 'هاص'; DIAMONDS = 'ديمن'; CLUBS = 'شيريا'; SPADES = 'سبيت'

class GamePhase(Enum):
    INIT = auto(); PHASE_1 = auto(); GABLAK_PHASE = auto(); PHASE_2 = auto()
    DOUBLING = auto(); PLAYING = auto(); SCORE_SUMMARY = auto()

@dataclass
class Card:
    suit: Suit; rank: str
    def __eq__(self, other): return isinstance(other, Card) and self.suit == other.suit and self.rank == other.rank
    def __hash__(self): return hash((self.suit, self.rank))

SUN_VALUES = {'A': 11, '10': 10, 'K': 4, 'Q': 3, 'J': 2, '9': 0, '8': 0, '7': 0}
HAKAM_VALUES = {'J': 20, '9': 14, 'A': 11, '10': 10, 'K': 4, 'Q': 3, '8': 0, '7': 0}
SUN_RANKING = ['A', '10', 'K', 'Q', 'J', '9', '8', '7']
HAKAM_RANKING = ['J', '9', 'A', '10', 'K', 'Q', '8', '7']
RANK_ORDER_PROJECTS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A']
PROJECT_RAW_PTS = {'سرا': (20, 20), 'خمسين': (50, 50), 'مية': (100, 100), 'أربعمية': (200, 0)}

# ==========================================
# 3. ASSETS MANAGER
# ==========================================
class AssetManager:
    _instance = None
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AssetManager, cls).__new__(cls)
            cls._instance.cards = {}; cls._instance.bgs = {}
            cls._instance.ads = []; cls._instance.card_back = None; cls._instance.card_back_small = None
            cls._instance.fonts = {}
        return cls._instance

    def load_assets(self):
        pygame.font.init()
        font_prefs = 'tahoma,segoeui,arial'
        self.fonts['main'] = pygame.font.SysFont(font_prefs, 24, bold=True)
        self.fonts['small'] = pygame.font.SysFont(font_prefs, 16, bold=True)
        self.fonts['chat'] = pygame.font.SysFont(font_prefs, 14, bold=True)
        self.fonts['title'] = pygame.font.SysFont(font_prefs, 32, bold=True)
        self.fonts['emoji'] = pygame.font.SysFont('segoeuiemoji,seguiemj,arial', 24)

        CARD_W, CARD_H = 75, 115; SMALL_W, SMALL_H = 40, 60
        bg_names = ['dark_gym.jpg', 'legendary_dewan.jpg', 'army.jpg', 'darl.jpg', 'game_room.jpg', 'kshtah.jpg', 'legacy.jpg']
        target_ratio = SCREEN_WIDTH / SCREEN_HEIGHT

        for bg_name in bg_names:
            try:
                img = pygame.image.load(os.path.join('roomsbackground', bg_name)).convert()
                img_w, img_h = img.get_size(); img_ratio = img_w / img_h
                if img_ratio > target_ratio:
                    new_w = int(img_h * target_ratio)
                    crop_rect = pygame.Rect((img_w - new_w) // 2, 0, new_w, img_h)
                else:
                    new_h = int(img_w / target_ratio)
                    crop_rect = pygame.Rect(0, (img_h - new_h) // 2, img_w, new_h)
                cropped_img = img.subsurface(crop_rect)
                self.bgs[bg_name] = pygame.transform.smoothscale(cropped_img, (SCREEN_WIDTH, SCREEN_HEIGHT))
            except:
                surf = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT)); surf.fill(C_BG_DARK)
                self.bgs[bg_name] = surf

        for ad_name in ['ad1.jpg', 'ad2.jpg']:
            try:
                ad_img = pygame.transform.smoothscale(pygame.image.load(os.path.join('shop', ad_name)).convert(), (SCREEN_WIDTH - 40, 150))
                self.ads.append(ad_img)
            except: pass
        if not self.ads: self.ads.append(pygame.Surface((SCREEN_WIDTH - 40, 150)))

        try:
            og_img = pygame.image.load(os.path.join('cards', 'og.png')).convert_alpha()
            self.card_back = pygame.transform.smoothscale(og_img, (CARD_W, CARD_H))
            self.card_back_small = pygame.transform.smoothscale(og_img, (SMALL_W, SMALL_H))
        except:
            self.card_back = pygame.Surface((CARD_W, CARD_H)); self.card_back.fill((80, 80, 80))
            self.card_back_small = pygame.transform.scale(self.card_back, (SMALL_W, SMALL_H))

        file_rank_map = {'7':'7', '8':'8', '9':'9', '10':'10', 'J':'jack', 'Q':'queen', 'K':'king', 'A':'ace'}
        for suit in Suit:
            for rank in RANK_ORDER_PROJECTS:
                file_name = f"{file_rank_map[rank]}_of_{suit.name.lower()}.png"
                try: self.cards[f"{rank}_of_{suit.name}"] = pygame.transform.smoothscale(pygame.image.load(os.path.join('cards', file_name)).convert_alpha(), (CARD_W, CARD_H))
                except:
                    surf = pygame.Surface((CARD_W, CARD_H)); surf.fill(C_WHITE)
                    self.cards[f"{rank}_of_{suit.name}"] = surf

# ==========================================
# 4. CORE ENGINE (FSM & AI)
# ==========================================
class BalootEngine:
    def __init__(self):
        self.phase = GamePhase.INIT; self.dealer_idx = 3; self.turn = 0
        self.floor_card = None; self.hands = [[], [], [], []]
        self.bid = {'type': None, 'suit': None, 'bidder': None}
        self.pass_count = 0; self.current_trick = []
        self.trick_count = 1; self.round_points = {1: 0, 2: 0}; self.tricks_won = {1: 0, 2: 0}
        self.double_level = 1; self.doubler_idx = None; self.buyer_team = 1
        self.initial_project_hands = {0: [], 1: [], 2: [], 3: []}
        self.declared_projects = {0: [], 1: [], 2: [], 3: []}; self.winning_project_team = None
        self.summary_data = {}; self.total_scores = {1: 0, 2: 0}
        
        self.played_cards = set()
        self.trick_akka_player = None
        
        # --- Qaid System ---
        self.trick_history = []
        self.mistakes = [] 
        
        self.deal_cards()

    def _generate_deck(self):
        deck = [Card(suit, rank) for suit in Suit for rank in RANK_ORDER_PROJECTS]
        random.shuffle(deck)
        return deck

    def get_next_turn(self, current): return (current + 1) % 4
    def get_prev_turn(self, current): return (current - 1 + 4) % 4

    def deal_cards(self):
        self.deck = self._generate_deck()
        for i in range(4): self.hands[i] = [self.deck.pop() for _ in range(5)]
        for i in range(4): self.hands[i].sort(key=lambda c: (SUIT_SORT_ORDER[c.suit.name], SUN_RANKING.index(c.rank)))
        self.floor_card = self.deck.pop(); self.phase = GamePhase.PHASE_1; self.turn = self.get_next_turn(self.dealer_idx)
        self.pass_count = 0; self.trick_count = 1; self.bid = {'type': None, 'suit': None, 'bidder': None}
        self.declared_projects = {0: [], 1: [], 2: [], 3: []}; self.winning_project_team = None
        
        self.played_cards = set()
        self.trick_akka_player = None
        self.trick_history = []
        self.mistakes = []

    def _deal_second_phase(self, is_ashkal, buyer_idx):
        recipient_idx = (buyer_idx + 2) % 4 if is_ashkal else buyer_idx
        for i in range(4):
            if i == recipient_idx: self.hands[i].extend([self.floor_card, self.deck.pop(), self.deck.pop()])
            else: self.hands[i].extend([self.deck.pop(), self.deck.pop(), self.deck.pop()])
        for i in range(4):
            self.hands[i].sort(key=lambda c: (SUIT_SORT_ORDER[c.suit.name], SUN_RANKING.index(c.rank)))
            self.initial_project_hands[i] = self.hands[i].copy()
        self.floor_card = None; self.trick_count = 1; self.round_points = {1: 0, 2: 0}; self.tricks_won = {1: 0, 2: 0}
        self.declared_projects = {0: [], 1: [], 2: [], 3: []}; self.winning_project_team = None
        self.double_level = 1; self.doubler_idx = None
        
        self.played_cards = set()
        self.trick_akka_player = None
        self.trick_history = []
        self.mistakes = []

    def finalize_bid(self, player_idx, action_type, selected_suit=None):
        is_ashkal = (action_type == 'ASHKAL')
        suit = selected_suit if action_type == 'HAKAM' else None
        self.bid = {'type': 'SUN' if action_type in ('SUN', 'ASHKAL') else 'HAKAM', 'suit': suit, 'bidder': player_idx}
        self.buyer_team = 1 if player_idx in (0, 2) else 2
        self._deal_second_phase(is_ashkal, player_idx)
        if self.bid['type'] == 'SUN': self.phase = GamePhase.PLAYING; self.turn = self.get_next_turn(self.dealer_idx)
        else: self.phase = GamePhase.DOUBLING; self.turn = self.get_next_turn(self.bid['bidder'])

    def _get_project_details(self, player_idx):
        hand = self.initial_project_hands[player_idx]
        if len(hand) < 8: return []
        is_sun = self.bid['type'] == 'SUN'; projects = []
        rank_counts = {r: [] for r in RANK_ORDER_PROJECTS}
        for c in hand: rank_counts[c.rank].append(c)
        for rank, cards in rank_counts.items():
            if len(cards) == 4:
                if rank == 'A' and is_sun: projects.append({'name': 'أربعمية', 'cards': cards.copy()})
                elif rank in ['10', 'J', 'Q', 'K', 'A']: projects.append({'name': 'مية', 'cards': cards.copy()})
        suits_groups = {s: [] for s in Suit}
        for c in hand: suits_groups[c.suit].append(c)
        for suit, cards in suits_groups.items():
            if len(cards) < 3: continue
            cards.sort(key=lambda c: RANK_ORDER_PROJECTS.index(c.rank))
            current_seq = [cards[0]]
            for i in range(1, len(cards)):
                if RANK_ORDER_PROJECTS.index(cards[i].rank) == RANK_ORDER_PROJECTS.index(current_seq[-1].rank) + 1: current_seq.append(cards[i])
                else:
                    if len(current_seq) >= 3: projects.append({'name': 'مية' if len(current_seq)>=5 else ('خمسين' if len(current_seq)==4 else 'سرا'), 'cards': current_seq.copy()})
                    current_seq = [cards[i]]
            if len(current_seq) >= 3: projects.append({'name': 'مية' if len(current_seq)>=5 else ('خمسين' if len(current_seq)==4 else 'سرا'), 'cards': current_seq.copy()})
        return projects

    def declare_project(self, player_idx, proj_name):
        details = self._get_project_details(player_idx)
        available_names = [p['name'] for p in details]
        if self.declared_projects[player_idx].count(proj_name) < available_names.count(proj_name):
            self.declared_projects[player_idx].append(proj_name)
            return True
        return False

    def _evaluate_winning_projects(self):
        t1_best, t2_best = (0, -1), (0, -1); proj_weights = {'سرا': 1, 'خمسين': 2, 'مية': 3, 'أربعمية': 4}
        for p_idx in range(4):
            declared = self.declared_projects[p_idx].copy()
            if not declared: continue
            for p_det in self._get_project_details(p_idx):
                if p_det['name'] in declared:
                    declared.remove(p_det['name'])
                    weight = proj_weights[p_det['name']]
                    max_rank_idx = max([RANK_ORDER_PROJECTS.index(c.rank) for c in p_det['cards']])
                    score_tuple = (weight, max_rank_idx)
                    if p_idx in (0, 2): t1_best = max(t1_best, score_tuple)
                    else: t2_best = max(t2_best, score_tuple)
        if t1_best == (0, -1) and t2_best == (0, -1): self.winning_project_team = None
        elif t1_best > t2_best: self.winning_project_team = 1
        elif t2_best > t1_best: self.winning_project_team = 2
        else: self.winning_project_team = self.buyer_team

    def get_declared_project_cards(self, player_idx):
        if self.winning_project_team != (1 if player_idx in (0, 2) else 2): return []
        declared_names = self.declared_projects[player_idx].copy(); cards_to_show = []
        for p in self._get_project_details(player_idx):
            if p['name'] in declared_names:
                cards_to_show.extend(p['cards']); declared_names.remove(p['name'])
        return list(set(cards_to_show))

    def is_akka(self, card):
        if len(self.current_trick) > 0:
            return False
        if self.bid['type'] != 'HAKAM' or card.suit == self.bid['suit']:
            return False
        stronger_ranks = SUN_RANKING[:SUN_RANKING.index(card.rank)]
        for r in stronger_ranks:
            stronger_card = Card(card.suit, r)
            if stronger_card not in self.played_cards:
                return False
        return True

    def get_legal_cards(self, player_idx):
        hand = self.hands[player_idx]
        if not self.current_trick: return list(range(len(hand)))
        
        lead_suit = self.current_trick[0][1].suit
        is_sun = self.bid['type'] == 'SUN'
        hakam_suit = self.bid['suit']
        
        cards_of_lead = [i for i, c in enumerate(hand) if c.suit == lead_suit]
        
        if is_sun: 
            return cards_of_lead if cards_of_lead else list(range(len(hand)))
            
        if lead_suit == hakam_suit:
            if cards_of_lead:
                best_rank_idx = min([HAKAM_RANKING.index(item[1].rank) for item in self.current_trick if item[1].suit == hakam_suit] + [99])
                over_trumps = [i for i in cards_of_lead if HAKAM_RANKING.index(hand[i].rank) < best_rank_idx]
                return over_trumps if over_trumps else cards_of_lead
            return list(range(len(hand)))
        else:
            if cards_of_lead: 
                return cards_of_lead
            else:
                partner_idx = (player_idx + 2) % 4
                is_partner_akka = (getattr(self, 'trick_akka_player', None) == partner_idx)
                
                hakam_cards = [i for i, c in enumerate(hand) if c.suit == hakam_suit]
                
                if hakam_cards and not is_partner_akka:
                    trick_hakams = [item for item in self.current_trick if item[1].suit == hakam_suit]
                    if trick_hakams:
                        best_hakam_idx = min([HAKAM_RANKING.index(item[1].rank) for item in trick_hakams])
                        over_trumps = [i for i in hakam_cards if HAKAM_RANKING.index(hand[i].rank) < best_hakam_idx]
                        return over_trumps if over_trumps else hakam_cards
                    return hakam_cards
                
                return list(range(len(hand)))

    def get_bot_best_move(self, bot_idx):
        legal_moves = self.get_legal_cards(bot_idx)
        hand = self.hands[bot_idx]
        
        if random.random() < 0.03 and len(hand) > 1:
            all_moves = list(range(len(hand)))
            illegal_moves = [m for m in all_moves if m not in legal_moves]
            if illegal_moves:
                return random.choice(illegal_moves)

        if not legal_moves: return 0
        if len(legal_moves) == 1: return legal_moves[0]
        
        is_sun = self.bid['type'] == 'SUN'
        hakam_suit = self.bid['suit']
        
        def c_val(c):
            if is_sun: return SUN_VALUES[c.rank]
            return HAKAM_VALUES[c.rank] if c.suit == hakam_suit else SUN_VALUES[c.rank]
            
        if len(self.current_trick) == 0:
            for idx in legal_moves:
                if self.is_akka(hand[idx]): return idx
            if is_sun:
                for idx in legal_moves:
                    if hand[idx].rank == 'A': return idx
            else:
                for idx in legal_moves:
                    if hand[idx].suit == hakam_suit and hand[idx].rank in ['J', '9']: return idx
            return min(legal_moves, key=lambda i: c_val(hand[i]))
        else:
            winning_moves = []
            for idx in legal_moves:
                self.current_trick.append((bot_idx, hand[idx], 0, 0, 0))
                temp_winner, _ = self.evaluate_trick()
                self.current_trick.pop()
                if temp_winner == bot_idx:
                    winning_moves.append(idx)
                    
            partner_idx = (bot_idx + 2) % 4
            current_winner, _ = self.evaluate_trick()
            
            if current_winner == partner_idx:
                if len(self.current_trick) == 3:
                    return max(legal_moves, key=lambda i: c_val(hand[i]))
                else:
                    return min(legal_moves, key=lambda i: c_val(hand[i]))
            else:
                if winning_moves:
                    return min(winning_moves, key=lambda i: c_val(hand[i]))
                else:
                    return min(legal_moves, key=lambda i: c_val(hand[i]))

    def evaluate_trick(self):
        lead_suit = self.current_trick[0][1].suit
        winner_idx = self.current_trick[0][0]
        winning_card = self.current_trick[0][1]
        trick_points = 0
        is_sun = self.bid['type'] == 'SUN'
        hakam_suit = self.bid['suit']

        for item in self.current_trick:
            player_idx, card = item[0], item[1]
            trick_points += SUN_VALUES[card.rank] if is_sun else (HAKAM_VALUES[card.rank] if card.suit == hakam_suit else SUN_VALUES[card.rank])
            if is_sun:
                if card.suit == lead_suit and SUN_RANKING.index(card.rank) < SUN_RANKING.index(winning_card.rank):
                    winning_card, winner_idx = card, player_idx
            else:
                if winning_card.suit == hakam_suit:
                    if card.suit == hakam_suit and HAKAM_RANKING.index(card.rank) < HAKAM_RANKING.index(winning_card.rank):
                        winning_card, winner_idx = card, player_idx
                else:
                    if card.suit == hakam_suit: winning_card, winner_idx = card, player_idx
                    elif card.suit == lead_suit and SUN_RANKING.index(card.rank) < SUN_RANKING.index(winning_card.rank):
                        winning_card, winner_idx = card, player_idx

        return winner_idx, trick_points

    def play_card(self, player_idx, card_index):
        if self.phase != GamePhase.PLAYING or self.turn != player_idx or len(self.hands[player_idx]) <= card_index or len(self.current_trick) >= 4: return
        
        legal_moves = self.get_legal_cards(player_idx)
        is_mistake = card_index not in legal_moves
        
        card = self.hands[player_idx][card_index]
        
        if is_mistake:
            legal_cards = [self.hands[player_idx][i] for i in legal_moves]
            self.mistakes.append({
                'player': player_idx,
                'played_card': card,
                'legal_cards_held': legal_cards
            })
        
        if self.is_akka(card):
            self.trick_akka_player = player_idx
            
        toss_angle = random.randint(-20, 20); toss_dx = random.randint(-18, 18); toss_dy = random.randint(-18, 18)
        self.current_trick.append((player_idx, self.hands[player_idx].pop(card_index), toss_angle, toss_dx, toss_dy))
        
        self.played_cards.add(card)
        if len(self.current_trick) < 4: self.turn = self.get_next_turn(self.turn)
        else: self.turn = -1

    def resolve_trick(self):
        self.trick_history.append(self.current_trick.copy())
        
        winner_idx, trick_points = self.evaluate_trick()
        self.round_points[1 if winner_idx in (0, 2) else 2] += trick_points

        self.current_trick = []; self.turn = winner_idx
        self.trick_akka_player = None 
        
        if self.trick_count == 1: self._evaluate_winning_projects()
        self.trick_count += 1; win_team = 1 if winner_idx in (0, 2) else 2; self.tricks_won[win_team] += 1

        if not self.hands[0]:
            self.finalize_round()

    def finalize_round(self, forced_win_team=None):
        is_sun = self.bid['type'] == 'SUN'; idx_pts = 0 if is_sun else 1; buyer = self.buyer_team; defender = 2 if buyer == 1 else 1
        raw_tricks = {1: self.round_points[1], 2: self.round_points[2]}
        ground_pts = {1: 0, 2: 0}
        if forced_win_team is None and self.tricks_won[1] + self.tricks_won[2] > 0:
            last_win = 1 if self.tricks_won[1] > self.tricks_won[2] else 2 
            ground_pts[last_win] = 10
            
        raw_proj = {1: 0, 2: 0}
        if self.winning_project_team is not None:
            for p_idx, projs in self.declared_projects.items():
                t_id = 1 if p_idx in (0, 2) else 2
                if t_id == self.winning_project_team:
                    for proj in projs: raw_proj[t_id] += PROJECT_RAW_PTS[proj][idx_pts]

        abnat = {1: raw_tricks[1] + ground_pts[1] + raw_proj[1], 2: raw_tricks[2] + ground_pts[2] + raw_proj[2]}
        def round_baloot(pts): return int(math.floor((pts + 5) / 10))
        base_final = {1: round_baloot(abnat[1]) * (2 if is_sun else 1), 2: round_baloot(abnat[2]) * (2 if is_sun else 1)}

        is_kaput = False; kaput_team = None
        is_doubled = self.double_level > 1; is_fall = False; final_round_score = {1: 0, 2: 0}

        if forced_win_team is not None:
            is_kaput = True; kaput_team = forced_win_team
            kaput_base = 44 if is_sun else 25
            proj_final = {1: int(raw_proj[1]/10)*(2 if is_sun else 1), 2: int(raw_proj[2]/10)*(2 if is_sun else 1)}
            final_round_score[kaput_team] = kaput_base + proj_final[kaput_team]; final_round_score[3 - kaput_team] = 0
        else:
            if self.tricks_won[1] == 8: is_kaput = True; kaput_team = 1
            elif self.tricks_won[2] == 8: is_kaput = True; kaput_team = 2

            if is_kaput:
                kaput_base = 44 if is_sun else 25
                proj_final = {1: int(raw_proj[1]/10)*(2 if is_sun else 1), 2: int(raw_proj[2]/10)*(2 if is_sun else 1)}
                final_round_score[kaput_team] = kaput_base + proj_final[kaput_team]; final_round_score[3 - kaput_team] = 0
            else:
                b_score = base_final[buyer]; d_score = base_final[defender]
                if is_doubled:
                    multiplier = self.double_level if self.double_level <= 4 else 999
                    total_board = base_final[1] + base_final[2]
                    if b_score > d_score: final_round_score[buyer] = total_board * multiplier; final_round_score[defender] = 0
                    else: final_round_score[defender] = total_board * multiplier; final_round_score[buyer] = 0; is_fall = True
                    if self.double_level == 5:
                        if b_score > d_score: final_round_score[buyer] = 152
                        else: final_round_score[defender] = 152
                else:
                    if b_score < d_score or b_score == d_score: final_round_score[defender] = base_final[1] + base_final[2]; final_round_score[buyer] = 0; is_fall = True
                    else: final_round_score[1] = base_final[1]; final_round_score[2] = base_final[2]

        self.total_scores[1] += final_round_score[1]; self.total_scores[2] += final_round_score[2]
        self.summary_data = {'raw_tricks': raw_tricks, 'ground': ground_pts, 'projects': raw_proj, 'abnat': abnat, 'final': final_round_score, 'is_kaput': is_kaput, 'kaput_team': kaput_team, 'is_fall': is_fall, 'is_doubled': is_doubled, 'multiplier': self.double_level, 'buyer': buyer}
        self.phase = GamePhase.SCORE_SUMMARY; self.turn = -1

    def start_new_round(self): self.dealer_idx = self.get_next_turn(self.dealer_idx); self.deal_cards()

    def process_bidding(self, action_type, player_idx, selected_suit=None):
        if self.phase == GamePhase.PHASE_1:
            if action_type == 'PASS':
                self.pass_count += 1
                if self.pass_count == 4: self.phase = GamePhase.PHASE_2; self.turn = self.get_next_turn(self.dealer_idx); self.pass_count = 0
                else: self.turn = self.get_next_turn(self.turn)
            elif action_type == 'SUN':
                if player_idx != self.get_next_turn(self.dealer_idx): self.bid = {'type': 'SUN', 'suit': None, 'bidder': player_idx}; self.phase = GamePhase.GABLAK_PHASE; self.turn = self.get_prev_turn(player_idx)
                else: self.finalize_bid(player_idx, 'SUN')
            else: self.finalize_bid(player_idx, action_type, self.floor_card.suit)
        elif self.phase == GamePhase.GABLAK_PHASE:
            if action_type == 'PASS': self.finalize_bid(self.bid['bidder'], 'SUN')
            elif action_type == 'GABLAK':
                self.bid['bidder'] = player_idx
                if player_idx == self.get_next_turn(self.dealer_idx): self.finalize_bid(player_idx, 'SUN')
                else: self.turn = self.get_prev_turn(player_idx)
        elif self.phase == GamePhase.PHASE_2:
            if action_type == 'PASS':
                self.pass_count += 1
                if self.pass_count == 4: self.start_new_round()
                else: self.turn = self.get_next_turn(self.turn)
            else: self.finalize_bid(player_idx, action_type, selected_suit)

    def process_doubling(self, action_type, player_idx):
        if action_type == 'PASS':
            if self.double_level == 1:
                self.pass_count += 1
                if self.pass_count == 1: self.turn = (self.bid['bidder'] + 3) % 4
                else: self.phase = GamePhase.PLAYING; self.turn = self.get_next_turn(self.dealer_idx)
            else: self.phase = GamePhase.PLAYING; self.turn = self.get_next_turn(self.dealer_idx)
        elif action_type == 'DOUBLE': self.double_level = 2; self.doubler_idx = player_idx; self.turn = self.bid['bidder']
        elif action_type == 'THREE': self.double_level = 3; self.turn = self.doubler_idx
        elif action_type == 'FOUR': self.double_level = 4; self.turn = self.bid['bidder']
        elif action_type == 'GAHWA': self.double_level = 5; self.phase = GamePhase.PLAYING; self.turn = self.get_next_turn(self.dealer_idx)

# ==========================================
# 5. UI RENDERER & GAME LOOP
# ==========================================
class GameUI:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("بطل البلوت - Baloot Hero")
        self.clock = pygame.time.Clock()
        self.assets = AssetManager()
        self.assets.load_assets()

        self.app_state = AppState.MAIN_MENU
        self.profile = {
            'name': 'v0xF10A', 'coins': 966897, 'gems': 1250, 'rank_idx': 0,
            'active_bg': 'dark_gym.jpg', 'stats': {'wins': 15, 'losses': 4, 'played': 19}
        }
        self.engine = BalootEngine()
        self._setup_dealing_animation()
        self.last_turn = self.engine.turn; self.last_phase = self.engine.phase
        self.turn_start_time = pygame.time.get_ticks()
        self.trick_delay_start = 0; self.summary_start_time = 0

        self.chat_bubbles = {}; self.show_chat_menu = False
        self.show_suit_selection = False; self.active_project_buttons = []

        self.avatar_positions = {
            0: (SCREEN_WIDTH - 50, SCREEN_HEIGHT // 2),
            1: (SCREEN_WIDTH // 2, 80),
            2: (50, SCREEN_HEIGHT // 2),
            3: (SCREEN_WIDTH // 2, SCREEN_HEIGHT - 170)
        }
        self.card_throw_anims = {}
        self.card_collect_anims = []
        self.show_gift_menu = None
        self.gift_anims = []
        self.active_gifts = {0: [], 1: [], 2: [], 3: []}

        self.hovered_card = -1
        self.active_buttons = []
        self.active_gift_opts = []
        self._menu_rects = {}
        
        self.scheduled_chats = []
        self.has_replied_greeting = False
        
        # --- Qaid UI State ---
        self.show_qaid_menu = False
        self.qaid_data = {'reason': None, 'cards': []}
        self.qaid_rects = {'reasons': [], 'cards': [], 'submit': None, 'close': None}
        self.qaid_scroll_y = 0
        self.qaid_max_scroll = 0
        self.qaid_start_time = 0

        # --- Pre-select System ---
        self.pre_selected_card = None

        # --- Auto Pass ---
        self.auto_pass = False

        # --- Dealing Animation ---
        self.dealing_animations = []
        self.is_dealing = False
        self.dealing_start_time = 0
        self._last_total_cards = 0

    def add_chat_bubble(self, player_idx, text):
        self.chat_bubbles[player_idx] = {'text': text, 'time': pygame.time.get_ticks()}

    def schedule_bot_chat(self, p_idx, text, delay):
        self.scheduled_chats.append({'time': pygame.time.get_ticks() + delay, 'p_idx': p_idx, 'text': text})

    def _setup_dealing_animation(self):
        self.dealing_animations = []
        delay = 0
        for p_idx in range(4):
            for card in self.engine.hands[p_idx]:
                ex, ey = self.avatar_positions[p_idx]
                self.dealing_animations.append({
                    'card': card, 'p_idx': p_idx, 'delay': delay,
                    'start_x': SCREEN_WIDTH // 2, 'start_y': SCREEN_HEIGHT // 2,
                    'end_x': ex, 'end_y': ey, 'progress': 0.0
                })
                delay += 80
        self.is_dealing = True
        self.dealing_start_time = pygame.time.get_ticks()
        self.pre_selected_card = None

    def _update_dealing_animation(self):
        if not self.is_dealing: return
        current_time = pygame.time.get_ticks()
        elapsed = current_time - self.dealing_start_time
        all_done = True
        for anim in self.dealing_animations:
            if elapsed >= anim['delay']:
                card_elapsed = elapsed - anim['delay']
                anim['progress'] = min(1.0, card_elapsed / 350.0)
                if anim['progress'] < 1.0: all_done = False
            else:
                all_done = False
        if all_done:
            self.is_dealing = False

    def _draw_dealing_animation(self):
        if not self.is_dealing: return
        for anim in self.dealing_animations:
            if anim['progress'] <= 0 or anim['progress'] >= 1: continue
            p = anim['progress']
            p_eased = 1 - (1 - p) ** 3
            cx = anim['start_x'] + (anim['end_x'] - anim['start_x']) * p_eased
            cy = anim['start_y'] + (anim['end_y'] - anim['start_y']) * p_eased
            arc = math.sin(p * math.pi) * -50
            card_key = f"{anim['card'].rank}_of_{anim['card'].suit.name}"
            if anim['p_idx'] == 3:
                card_surf = pygame.transform.smoothscale(self.assets.cards[card_key], (40, 60))
            else:
                card_surf = self.assets.card_back_small
            self.screen.blit(card_surf, card_surf.get_rect(center=(cx, cy + arc)))

    def perform_play_card(self, p_idx, c_idx):
        if c_idx >= len(self.engine.hands[p_idx]): return
        card = self.engine.hands[p_idx][c_idx]
        start_pos = self.avatar_positions[p_idx]
        if p_idx == 3:
            overlap = 35; num_cards = len(self.engine.hands[3])
            start_x = (SCREEN_WIDTH - ((num_cards - 1) * overlap + 75)) // 2 + c_idx * overlap
            start_pos = (start_x + 37, SCREEN_HEIGHT - 60)

        is_akka = self.engine.is_akka(card)

        self.engine.play_card(p_idx, c_idx)
        self.card_throw_anims[p_idx] = {'start_time': pygame.time.get_ticks(), 'duration': 300, 'start_pos': start_pos, 'card': card}

        if is_akka and card.rank != 'A':
            self.add_chat_bubble(p_idx, "إكة!")

    def update_timers_and_bots(self):
        current_time = pygame.time.get_ticks()

        if self.show_qaid_menu:
            if current_time - self.qaid_start_time >= 60000:
                self.show_qaid_menu = False
            return 
        
        for sc in self.scheduled_chats[:]:
            if current_time >= sc['time']:
                self.add_chat_bubble(sc['p_idx'], sc['text'])
                self.scheduled_chats.remove(sc)

        keys_to_remove = [k for k, v in self.chat_bubbles.items() if current_time - v['time'] > 2500]
        for k in keys_to_remove: del self.chat_bubbles[k]

        # --- Dealing Animation ---
        self._update_dealing_animation()

        total_cards = sum(len(h) for h in self.engine.hands)
        if total_cards != self._last_total_cards:
            self._last_total_cards = total_cards
            if not self.is_dealing and self.engine.phase in (GamePhase.PHASE_1, GamePhase.INIT):
                self._setup_dealing_animation()

        if self.engine.phase == GamePhase.SCORE_SUMMARY:
            if self.summary_start_time == 0: self.summary_start_time = current_time
            elif current_time - self.summary_start_time > 4000:
                self.summary_start_time = 0; self.engine.start_new_round()
            return

        if len(self.engine.current_trick) == 4:
            if self.trick_delay_start == 0:
                self.trick_delay_start = current_time
            elif current_time - self.trick_delay_start > 1500:
                trick_cards = self.engine.current_trick.copy()
                winner_idx, _ = self.engine.evaluate_trick() 
                
                if winner_idx in (0, 2):
                    for item in trick_cards:
                        if item[0] == 3:
                            for m in self.engine.mistakes:
                                if item[1] == m['played_card']:
                                    if random.random() < 0.6: 
                                        self.schedule_bot_chat(1 if winner_idx == 0 else 0, "صادوه! قيد!", 500)
                                        self.engine.finalize_round(forced_win_team=2) 
                                        self.trick_delay_start = 0
                                        return
                
                self.card_collect_anims.append({
                    'start_time': current_time, 'duration': 400,
                    'winner': winner_idx, 'cards': trick_cards
                })
                self.engine.resolve_trick()
                self.trick_delay_start = 0
            return

        if self.engine.turn != self.last_turn or self.engine.phase != self.last_phase:
            self.last_turn = self.engine.turn; self.last_phase = self.engine.phase
            self.turn_start_time = current_time; self.show_suit_selection = False
            if self.engine.phase != GamePhase.PLAYING:
                self.pre_selected_card = None

        if self.engine.turn == -1: return

        # Auto-play pre-selected card
        if self.engine.turn == 3 and self.engine.phase == GamePhase.PLAYING and self.pre_selected_card is not None:
            if len(self.engine.current_trick) < 4:
                hand = self.engine.hands[3]
                try:
                    c_idx = hand.index(self.pre_selected_card)
                except ValueError:
                    c_idx = -1
                if c_idx >= 0:
                    legal_moves = self.engine.get_legal_cards(3)
                    if c_idx in legal_moves:
                        self.perform_play_card(3, c_idx)
                self.pre_selected_card = None

        # Auto-pass
        if self.engine.turn == 3 and self.auto_pass:
            if self.engine.phase in (GamePhase.PHASE_1, GamePhase.PHASE_2, GamePhase.GABLAK_PHASE):
                msg = "ولا" if self.engine.phase == GamePhase.PHASE_2 else "بس"
                if not self.show_suit_selection:
                    self.add_chat_bubble(3, msg)
                    self.engine.process_bidding('PASS', 3)
            elif self.engine.phase == GamePhase.DOUBLING:
                self.add_chat_bubble(3, "بس")
                self.engine.process_doubling('PASS', 3)

        elapsed = current_time - self.turn_start_time
        limit = 5000 if self.engine.turn == 3 else 1500

        if elapsed > limit:
            if self.engine.phase in (GamePhase.PHASE_1, GamePhase.PHASE_2, GamePhase.GABLAK_PHASE):
                msg = "ولا" if self.engine.phase == GamePhase.PHASE_2 else "بس"
                self.add_chat_bubble(self.engine.turn, msg)
                self.engine.process_bidding('PASS', self.engine.turn)
            elif self.engine.phase == GamePhase.DOUBLING:
                self.add_chat_bubble(self.engine.turn, "بس")
                self.engine.process_doubling('PASS', self.engine.turn)
            elif self.engine.phase == GamePhase.PLAYING:
                if self.engine.hands[self.engine.turn]:
                    if self.engine.trick_count == 1:
                        bot_projs = self.engine._get_project_details(self.engine.turn)
                        for p in bot_projs:
                            if self.engine.declare_project(self.engine.turn, p['name']):
                                self.add_chat_bubble(self.engine.turn, p['name'])
                    legal_moves = self.engine.get_legal_cards(self.engine.turn)
                    if self.engine.hands[self.engine.turn]: 
                        best_move = self.engine.get_bot_best_move(self.engine.turn)
                        self.perform_play_card(self.engine.turn, best_move)

    def draw_top_bar(self):
        pygame.draw.rect(self.screen, (28, 30, 38), (0, 0, SCREEN_WIDTH, 60))
        font = self.assets.fonts['small']
        
        coin_rect = pygame.Rect(15, 15, 110, 30)
        pygame.draw.rect(self.screen, (40, 40, 30), coin_rect, border_radius=15)
        pygame.draw.rect(self.screen, C_GOLD, coin_rect, width=1, border_radius=15)
        self.screen.blit(render_arabic(font, f"{self.profile['coins']:,}", C_GOLD), (45, 18))
        pygame.draw.circle(self.screen, C_GOLD, (30, 30), 8)
        
        gem_rect = pygame.Rect(135, 15, 100, 30)
        pygame.draw.rect(self.screen, (40, 30, 40), gem_rect, border_radius=15)
        pygame.draw.rect(self.screen, C_GEM, gem_rect, width=1, border_radius=15)
        self.screen.blit(render_arabic(font, f"{self.profile['gems']:,}", C_GEM), (165, 18))
        pygame.draw.circle(self.screen, C_GEM, (150, 30), 8)

        pygame.draw.circle(self.screen, (200, 200, 200), (SCREEN_WIDTH - 30, 30), 10)
        pygame.draw.circle(self.screen, (28, 30, 38), (SCREEN_WIDTH - 30, 30), 4)

    def draw_main_menu(self):
        self.screen.fill(C_BG_DARK)
        self.draw_top_bar()
        
        font_main = self.assets.fonts['main']
        font_chat = self.assets.fonts['chat']
        
        avatar_y = 150
        avatar_rect = pygame.Rect(SCREEN_WIDTH//2 - 50, avatar_y - 50, 100, 100)
        pygame.draw.circle(self.screen, (200, 120, 50), (SCREEN_WIDTH//2, avatar_y), 55)
        pygame.draw.circle(self.screen, (220, 220, 220), (SCREEN_WIDTH//2, avatar_y), 50)
        
        badge_rect = pygame.Rect(0, 0, 130, 26)
        badge_rect.center = (SCREEN_WIDTH//2, avatar_y + 45)
        pygame.draw.rect(self.screen, (240, 240, 240), badge_rect, border_radius=13)
        pygame.draw.rect(self.screen, (200, 100, 40), pygame.Rect(badge_rect.x, badge_rect.y, 70, 26), border_radius=13)
        badge_text = render_arabic(font_chat, RANKS[self.profile['rank_idx']], C_WHITE)
        self.screen.blit(badge_text, badge_text.get_rect(center=(badge_rect.x + 35, badge_rect.centery)))
        
        name_surf = render_arabic(font_main, self.profile['name'], C_WHITE)
        self.screen.blit(name_surf, name_surf.get_rect(center=(SCREEN_WIDTH//2, avatar_y + 85)))
        
        cy = 340; cx = SCREEN_WIDTH // 2; size = 50
        line_col = (60, 65, 80)
        pygame.draw.line(self.screen, line_col, (cx, cy-size), (cx, cy+size), 1)
        pygame.draw.line(self.screen, line_col, (cx-size, cy), (cx+size, cy), 1)
        pygame.draw.polygon(self.screen, line_col, [(cx, cy-size), (cx+size, cy), (cx, cy+size), (cx-size, cy)], 1)
        pygame.draw.polygon(self.screen, line_col, [(cx, cy-size//2), (cx+size//2, cy), (cx, cy+size//2), (cx-size//2, cy)], 1)
        
        pygame.draw.polygon(self.screen, (200, 100, 30), [(cx, cy-size+10), (cx+size-15, cy), (cx, cy+size-25), (cx-size+20, cy)], 2)
        
        lbl_top = render_arabic(font_chat, "المشتري", (220, 60, 60)); self.screen.blit(lbl_top, lbl_top.get_rect(center=(cx, cy-size-15)))
        lbl_right = render_arabic(font_chat, "لسرعة", (60, 180, 220)); self.screen.blit(lbl_right, lbl_right.get_rect(midleft=(cx+size+10, cy)))
        lbl_bot = render_arabic(font_chat, "اللعب", (60, 220, 100)); self.screen.blit(lbl_bot, lbl_bot.get_rect(center=(cx, cy+size+15)))
        lbl_left = render_arabic(font_chat, "المغامر", (220, 180, 60)); self.screen.blit(lbl_left, lbl_left.get_rect(midright=(cx-size-10, cy)))
        
        btn_quick = pygame.Rect(30, 430, SCREEN_WIDTH - 60, 75)
        pygame.draw.rect(self.screen, (25, 45, 55), btn_quick, border_radius=12)
        pygame.draw.rect(self.screen, (30, 100, 110), btn_quick, width=1, border_radius=12)
        
        q_title = render_arabic(font_main, "سكة سريعة", (60, 180, 220))
        q_sub = render_arabic(font_chat, "العب الآن ضد البوتات", (150, 150, 160))
        self.screen.blit(q_title, (btn_quick.right - 20 - q_title.get_width(), btn_quick.y + 15))
        self.screen.blit(q_sub, (btn_quick.right - 20 - q_sub.get_width(), btn_quick.y + 45))
        pygame.draw.rect(self.screen, (240, 240, 240), (btn_quick.x + 20, btn_quick.y + 20, 26, 36), border_radius=4)
        
        gw = (SCREEN_WIDTH - 80) // 2
        gh = 90
        gy = 525
        btn_rooms = pygame.Rect(SCREEN_WIDTH//2 + 10, gy, gw, gh) 
        btn_ranked = pygame.Rect(30, gy, gw, gh)                 
        btn_events = pygame.Rect(SCREEN_WIDTH//2 + 10, gy + gh + 15, gw, gh) 
        btn_tourny = pygame.Rect(30, gy + gh + 15, gw, gh)       
        
        buttons = [(btn_rooms, "الجلسات", "🛋️"), (btn_ranked, "سلم التحدي", "🏆"), (btn_events, "الأحداث", "🎁"), (btn_tourny, "بطولات", "👑")]
        
        for rect, title, emoji in buttons:
            pygame.draw.rect(self.screen, (35, 38, 48), rect, border_radius=12)
            t_surf = render_arabic(font_chat, title, C_WHITE)
            self.screen.blit(t_surf, t_surf.get_rect(center=(rect.centerx, rect.centery + 15)))
            try:
                e_surf = self.assets.fonts['emoji'].render(emoji, True, C_WHITE)
                self.screen.blit(e_surf, e_surf.get_rect(center=(rect.centerx, rect.centery - 15)))
            except: pass
            
        nav_h = 70
        nav_y = SCREEN_HEIGHT - nav_h
        pygame.draw.rect(self.screen, (20, 22, 28), (0, nav_y, SCREEN_WIDTH, nav_h))
        pygame.draw.rect(self.screen, (40, 42, 48), (0, nav_y, SCREEN_WIDTH, nav_h), width=1)
        
        nav_items = ["الرئيسية", "الشنطة", "المهام", "الأصدقاء", "الرسائل"]
        n_w = SCREEN_WIDTH // 5
        for i, item in enumerate(nav_items):
            c = (60, 180, 220) if i == 0 else (120, 120, 130)
            t_surf = render_arabic(font_chat, item, c)
            self.screen.blit(t_surf, t_surf.get_rect(center=(SCREEN_WIDTH - (i * n_w + n_w//2), nav_y + 45)))
            pygame.draw.circle(self.screen, c, (SCREEN_WIDTH - (i * n_w + n_w//2), nav_y + 20), 6)
            
        self._menu_rects['main'] = (btn_quick, btn_ranked, btn_rooms, avatar_rect)

    def draw_shop(self):
        self.screen.fill(C_BG_DARK); self.draw_top_bar()
        font_main = self.assets.fonts['main']
        ad_idx = (pygame.time.get_ticks() // 3000) % len(self.assets.ads); self.screen.blit(self.assets.ads[ad_idx], (20, 80))
        title_surf = render_arabic(font_main, "استئجار الجلسات", C_WHITE); self.screen.blit(title_surf, (SCREEN_WIDTH - 20 - title_surf.get_width(), 245))
        bg_names = list(self.assets.bgs.keys()); cols = 3; bw = (SCREEN_WIDTH - 80) // cols; bh = int(bw * (16/9)); buttons = []; start_y = 290
        for i, bg_name in enumerate(bg_names):
            col, row = i % cols, i // cols
            rect = pygame.Rect(20 + col * (bw + 20), start_y + row * (bh + 20), bw, bh)
            preview = pygame.transform.smoothscale(self.assets.bgs[bg_name], (bw, bh))
            self.screen.blit(preview, rect.topleft)
            if self.profile['active_bg'] == bg_name:
                pygame.draw.rect(self.screen, C_TIMER_HUMAN, rect, width=3, border_radius=8)
                tag_txt = render_arabic(self.assets.fonts['chat'], "مستخدم", C_WHITE)
                tag_rect = pygame.Rect(rect.x, rect.y + bh - 25, rect.width, 25)
                pygame.draw.rect(self.screen, C_TIMER_HUMAN, tag_rect, border_bottom_left_radius=8, border_bottom_right_radius=8)
                self.screen.blit(tag_txt, tag_txt.get_rect(center=tag_rect.center))
            else: pygame.draw.rect(self.screen, (60, 60, 80), rect, width=1, border_radius=8)
            buttons.append({'rect': rect, 'bg_name': bg_name})
        btn_back = pygame.Rect(20, SCREEN_HEIGHT - 80, SCREEN_WIDTH - 40, 60)
        pygame.draw.rect(self.screen, (200, 80, 80), btn_back, border_radius=15)
        txt_b = render_arabic(font_main, "عودة للقائمة", C_WHITE); self.screen.blit(txt_b, txt_b.get_rect(center=btn_back.center))
        self._menu_rects['shop'] = (buttons, btn_back)

    def draw_profile(self):
        self.screen.fill(C_BG_DARK); self.draw_top_bar()
        font_title = self.assets.fonts['title']; font_main = self.assets.fonts['main']
        pygame.draw.circle(self.screen, (60, 70, 90), (SCREEN_WIDTH//2, 180), 60); pygame.draw.circle(self.screen, C_CYAN_GLOW, (SCREEN_WIDTH//2, 180), 60, 3)
        name_surf = render_arabic(font_title, self.profile['name'], C_WHITE); self.screen.blit(name_surf, (SCREEN_WIDTH//2 - name_surf.get_width()//2, 260))
        rank_surf = render_arabic(font_main, f"التصنيف: {RANKS[self.profile['rank_idx']]}", C_GOLD); self.screen.blit(rank_surf, (SCREEN_WIDTH//2 - rank_surf.get_width()//2, 300))
        stats_rect = pygame.Rect(40, 360, SCREEN_WIDTH - 80, 200)
        pygame.draw.rect(self.screen, (30, 40, 60), stats_rect, border_radius=15)
        st = self.profile['stats']
        rows = [("المباريات الملعوبة", st['played']), ("الانتصارات", st['wins']), ("الهزائم", st['losses'])]
        ry = 380
        for title, val in rows:
            t_surf = render_arabic(font_main, title, C_WHITE); v_surf = render_arabic(font_main, str(val), C_CYAN_GLOW)
            self.screen.blit(t_surf, (SCREEN_WIDTH - 60 - t_surf.get_width(), ry)); self.screen.blit(v_surf, (60, ry))
            pygame.draw.line(self.screen, (50, 60, 80), (60, ry+35), (SCREEN_WIDTH-60, ry+35)); ry += 50
        btn_back = pygame.Rect(20, SCREEN_HEIGHT - 80, SCREEN_WIDTH - 40, 60)
        pygame.draw.rect(self.screen, (200, 80, 80), btn_back, border_radius=10)
        txt_b = render_arabic(font_main, "عودة", C_WHITE); self.screen.blit(txt_b, txt_b.get_rect(center=btn_back.center))
        self._menu_rects['profile'] = btn_back

    def draw_fanned_hand(self, x, y, count, position):
        for i in range(count):
            angle_offset = (count / 2 - i) * 6
            ox, oy = x + (i - count / 2) * 8, y - 45
            rotated_card = pygame.transform.rotate(self.assets.card_back_small, angle_offset)
            self.screen.blit(rotated_card, rotated_card.get_rect(center=(ox, oy)).topleft)

    def draw_chat_bubbles(self, positions):
        for idx, bubble in self.chat_bubbles.items():
            px, py = positions[idx]
            bx, by = px, py - 60 if idx != 1 else py + 60
            text_surf = render_arabic(self.assets.fonts['chat'], bubble['text'], C_BTN_TEXT)
            rect_w, rect_h = text_surf.get_width() + 20, text_surf.get_height() + 10
            bubble_rect = pygame.Rect(bx - rect_w//2, by - rect_h//2, rect_w, rect_h)
            pygame.draw.rect(self.screen, C_WHITE, bubble_rect, border_radius=10)
            self.screen.blit(text_surf, text_surf.get_rect(center=bubble_rect.center))

    def draw_score_summary(self):
        if self.engine.phase != GamePhase.SCORE_SUMMARY: return
        overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT)); overlay.set_alpha(180); overlay.fill((0,0,0)); self.screen.blit(overlay, (0,0))

        font_b = self.assets.fonts['main']; font_s = self.assets.fonts['small']
        us_id, them_id = 2, 1
        summary = self.engine.summary_data

        if not summary: return

        rows = [("الأكلات", summary['raw_tricks'][us_id], summary['raw_tricks'][them_id]), ("الأرض", summary['ground'][us_id], summary['ground'][them_id])]
        if summary['projects'][us_id] > 0 or summary['projects'][them_id] > 0: rows.append(("المشاريع", summary['projects'][us_id], summary['projects'][them_id]))
        rows.append(("الابناط", summary['abnat'][us_id], summary['abnat'][them_id]))

        if summary.get('is_kaput'): rows.append(("كبوت!", "✔️" if summary['kaput_team']==us_id else "", "✔️" if summary['kaput_team']==them_id else ""))
        elif summary.get('is_fall'): rows.append(("خسارة", "سقوط" if summary['buyer']==us_id else "", "سقوط" if summary['buyer']==them_id else ""))
        elif summary.get('is_doubled'):
            m_str = f"x{summary['multiplier']}" if summary['multiplier'] < 5 else "قهوة"
            rows.append(("تدبيل", m_str, m_str))

        modal_w = 400; modal_h = 240 + len(rows) * 45
        mx, my = (SCREEN_WIDTH - modal_w)//2, (SCREEN_HEIGHT - modal_h)//2
        pygame.draw.rect(self.screen, C_MODAL_BG, (mx, my, modal_w, modal_h), border_radius=15)
        pygame.draw.rect(self.screen, (220, 220, 220), (mx, my, modal_w, 50), border_top_left_radius=15, border_top_right_radius=15)

        col_us, col_them, col_title = mx + 90, mx + 220, mx + modal_w - 20
        title_surf = render_arabic(font_b, "النشرة", C_BTN_TEXT); self.screen.blit(title_surf, (mx + modal_w//2 - title_surf.get_width()//2, my + 10))
        us_head = render_arabic(font_s, "لنا", C_BTN_TEXT); self.screen.blit(us_head, (col_us - us_head.get_width()//2, my + 60))
        them_head = render_arabic(font_s, "لهم", C_BTN_TEXT); self.screen.blit(them_head, (col_them - them_head.get_width()//2, my + 60))
        pygame.draw.line(self.screen, (200,200,200), (mx, my+90), (mx+modal_w, my+90), 2)

        ry = my + 110
        for title, us, them in rows:
            t_surf = render_arabic(font_s, title, C_BTN_TEXT); self.screen.blit(t_surf, (col_title - t_surf.get_width(), ry))
            u_surf = render_arabic(font_s, str(us), C_BTN_TEXT); self.screen.blit(u_surf, (col_us - u_surf.get_width()//2, ry))
            th_surf = render_arabic(font_s, str(them), C_BTN_TEXT); self.screen.blit(th_surf, (col_them - th_surf.get_width()//2, ry))
            ry += 45

        pygame.draw.rect(self.screen, (200, 210, 200), (mx, ry, modal_w, 60), border_bottom_left_radius=15, border_bottom_right_radius=15)
        res_surf = render_arabic(font_b, "النتيجة", (40, 100, 40)); self.screen.blit(res_surf, (col_title - res_surf.get_width(), ry + 15))
        u_tot = render_arabic(font_b, str(summary['final'][us_id]), C_BTN_TEXT); self.screen.blit(u_tot, (col_us - u_tot.get_width()//2, ry + 15))
        th_tot = render_arabic(font_b, str(summary['final'][them_id]), C_BTN_TEXT); self.screen.blit(th_tot, (col_them - th_tot.get_width()//2, ry + 15))

    def draw_qaid_menu(self):
        if not self.show_qaid_menu: return
        
        # Overlay Background
        overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((18, 20, 24, 230)) 
        self.screen.blit(overlay, (0,0))
        
        self.qaid_rects = {'reasons': [], 'cards': [], 'submit': None, 'close': None}
        font_b = self.assets.fonts['main']; font_s = self.assets.fonts['small']; font_title = self.assets.fonts['title']
        
        # --- Scrolling Area (Clipping) ---
        self.screen.set_clip(pygame.Rect(0, 80, SCREEN_WIDTH, SCREEN_HEIGHT - 80))
        
        # Base starting Y
        content_sy = 100
        
        # Title Texts
        t1 = render_arabic(font_title, "اختر سبب الاعتراض", C_WHITE)
        t2 = render_arabic(font_s, "اختر السبب الأقرب لما حدث.", (160, 170, 180))
        self.screen.blit(t1, t1.get_rect(center=(SCREEN_WIDTH//2, content_sy + self.qaid_scroll_y)))
        self.screen.blit(t2, t2.get_rect(center=(SCREEN_WIDTH//2, content_sy + self.qaid_scroll_y + 35)))
        content_sy += 70
        
        # Game Type (Visual Only)
        btn_type = pygame.Rect(SCREEN_WIDTH//2 - 70, content_sy + self.qaid_scroll_y, 140, 40)
        pygame.draw.rect(self.screen, C_CYAN_GLOW, btn_type, border_radius=20)
        t_type_str = "نوع اللعب: " + ("صن" if self.engine.bid['type'] == 'SUN' else "حكم")
        tt_surf = render_arabic(font_s, t_type_str, (0,0,0))
        self.screen.blit(tt_surf, tt_surf.get_rect(center=btn_type.center))
        content_sy += 70
        
        # --- Step 1: Reasons ---
        step1_box = pygame.Rect(20, content_sy + self.qaid_scroll_y, SCREEN_WIDTH - 40, 50)
        pygame.draw.rect(self.screen, (15, 15, 18), step1_box, border_top_left_radius=15, border_top_right_radius=15)
        pygame.draw.rect(self.screen, (255,255,255), step1_box, width=1, border_top_left_radius=15, border_top_right_radius=15)
        s1_t = render_arabic(font_b, "1. اختر السبب", C_WHITE)
        self.screen.blit(s1_t, (SCREEN_WIDTH - 40 - s1_t.get_width(), content_sy + self.qaid_scroll_y + 10))
        content_sy += 60
        
        reasons = QAID_REASONS.get(self.engine.bid['type'] or 'HAKAM', QAID_REASONS['HAKAM'])
        for reason in reasons:
            rect = pygame.Rect(40, content_sy + self.qaid_scroll_y, SCREEN_WIDTH - 80, 50)
            is_sel = (self.qaid_data['reason'] == reason)
            bg_col = (20, 50, 60) if is_sel else (25, 25, 30)
            pygame.draw.rect(self.screen, bg_col, rect, border_radius=10)
            pygame.draw.rect(self.screen, C_CYAN_GLOW if is_sel else (50, 50, 60), rect, width=1, border_radius=10)
            r_surf = render_arabic(font_s, reason, C_WHITE if is_sel else (200,200,200))
            self.screen.blit(r_surf, r_surf.get_rect(center=rect.center))
            self.qaid_rects['reasons'].append({'rect': rect, 'reason': reason})
            content_sy += 60
        
        content_sy += 20
        
        # --- Step 2: Proof (Tricks) ---
        step2_box = pygame.Rect(20, content_sy + self.qaid_scroll_y, SCREEN_WIDTH - 40, 50)
        pygame.draw.rect(self.screen, (15, 15, 18), step2_box, border_top_left_radius=15, border_top_right_radius=15)
        pygame.draw.rect(self.screen, (255,255,255), step2_box, width=1, border_top_left_radius=15, border_top_right_radius=15)
        s2_t = render_arabic(font_b, "2. إثبات", C_WHITE)
        self.screen.blit(s2_t, (SCREEN_WIDTH - 40 - s2_t.get_width(), content_sy + self.qaid_scroll_y + 10))
        content_sy += 60
        
        msg = render_arabic(font_s, "يمكنك اختيار كرت أو كرتين فقط من الأكلات.", (150, 150, 150))
        self.screen.blit(msg, msg.get_rect(center=(SCREEN_WIDTH//2, content_sy + self.qaid_scroll_y + 10)))
        content_sy += 40
        
        all_tricks = self.engine.trick_history.copy()
        if self.engine.current_trick: all_tricks.append(self.engine.current_trick)
        
        if not all_tricks:
            no_c = render_arabic(font_s, "لا توجد كروت ملعوبة بعد", (100,100,100))
            self.screen.blit(no_c, no_c.get_rect(center=(SCREEN_WIDTH//2, content_sy + self.qaid_scroll_y + 30)))
            content_sy += 80
            
        for t_idx, trick in enumerate(all_tricks):
            t_rect = pygame.Rect(40, content_sy + self.qaid_scroll_y, SCREEN_WIDTH - 80, 160)
            pygame.draw.rect(self.screen, (20, 22, 26), t_rect, border_radius=15)
            pygame.draw.rect(self.screen, (40, 42, 48), t_rect, width=1, border_radius=15)
            
            tr_num = render_arabic(font_s, f"أكلة {t_idx+1}", (150,150,150))
            self.screen.blit(tr_num, (t_rect.right - 15 - tr_num.get_width(), content_sy + self.qaid_scroll_y + 10))
            
            # --- التعديل هنا: توسعة المسافات بين الكروت المائلة (Fanned Cards Look) ---
            cx, cy = t_rect.center
            card_w, card_h = 45, 70
            positions = [(0, -35, 5), (-45, 5, -20), (45, 5, 20), (0, 35, -5)]
            
            for i, item in enumerate(trick):
                card = item[1]
                px, py, rot = positions[i % 4]
                
                c_key = f"{card.rank}_of_{card.suit.name}"
                c_surf = pygame.transform.smoothscale(self.assets.cards[c_key], (card_w, card_h))
                rotated = pygame.transform.rotate(c_surf, rot)
                
                card_rect = rotated.get_rect(center=(cx + px, cy + py))
                self.screen.blit(rotated, card_rect.topleft)
                
                if card in self.qaid_data['cards']:
                    pygame.draw.rect(self.screen, C_DANGER, card_rect, width=3, border_radius=4)
                    
                self.qaid_rects['cards'].append({'rect': card_rect, 'card': card})
                
            content_sy += 180

        # --- Remaining Hands ---
        content_sy += 20
        pygame.draw.line(self.screen, (50, 50, 60), (40, content_sy + self.qaid_scroll_y), (SCREEN_WIDTH - 40, content_sy + self.qaid_scroll_y))
        content_sy += 20

        rem_title = render_arabic(font_b, "الأوراق المتبقية للسباق", C_CYAN_GLOW)
        self.screen.blit(rem_title, rem_title.get_rect(center=(SCREEN_WIDTH//2, content_sy + self.qaid_scroll_y)))
        content_sy += 40

        for p_idx in range(4):
            hand = self.engine.hands[p_idx]
            if not hand: continue
            
            p_rect = pygame.Rect(40, content_sy + self.qaid_scroll_y, SCREEN_WIDTH - 80, 80)
            pygame.draw.rect(self.screen, (20, 22, 26), p_rect, border_radius=10)
            
            p_name_str = "اللاعب 1 (أنت)" if p_idx == 3 else f"اللاعب {p_idx}"
            p_name = render_arabic(font_s, p_name_str, C_WHITE)
            self.screen.blit(p_name, (p_rect.right - 15 - p_name.get_width(), content_sy + self.qaid_scroll_y + 30))
            
            hx = p_rect.x + 15
            for card in hand:
                c_key = f"{card.rank}_of_{card.suit.name}"
                c_surf = pygame.transform.smoothscale(self.assets.cards[c_key], (35, 55))
                c_rect = c_surf.get_rect(topleft=(hx, content_sy + self.qaid_scroll_y + 12))
                self.screen.blit(c_surf, c_rect.topleft)
                
                if card in self.qaid_data['cards']:
                    pygame.draw.rect(self.screen, C_DANGER, c_rect, width=2, border_radius=3)
                    
                self.qaid_rects['cards'].append({'rect': c_rect, 'card': card})
                hx += 25 # Overlap
                
            content_sy += 90
            
        # --- Step 3: Submit ---
        submit_btn = pygame.Rect(40, content_sy + self.qaid_scroll_y, SCREEN_WIDTH - 80, 55)
        can_submit = self.qaid_data['reason'] is not None and len(self.qaid_data['cards']) > 0
        pygame.draw.rect(self.screen, C_WHITE if can_submit else (60,60,60), submit_btn, border_radius=12)
        s_text = render_arabic(font_b, "إرسال القيد", C_BTN_TEXT if can_submit else (120,120,120))
        self.screen.blit(s_text, s_text.get_rect(center=submit_btn.center))
        if can_submit: self.qaid_rects['submit'] = submit_btn
        
        content_sy += 100
        
        # --- التعديل هنا: تصليح مشكلة السكرول عبر حساب الطول الإجمالي الصافي ---
        self.qaid_max_scroll = min(0, SCREEN_HEIGHT - content_sy)
        
        self.screen.set_clip(None)

        # --- Fixed Header ---
        header_rect = pygame.Rect(0, 0, SCREEN_WIDTH, 80)
        pygame.draw.rect(self.screen, (18, 20, 24), header_rect)
        pygame.draw.line(self.screen, (40, 40, 45), (0, 80), (SCREEN_WIDTH, 80))
        
        btn_close = pygame.Rect(SCREEN_WIDTH - 60, 25, 40, 40)
        x_surf = render_arabic(font_b, "➔", (160, 170, 180))
        self.screen.blit(x_surf, x_surf.get_rect(center=btn_close.center))
        self.qaid_rects['close'] = btn_close
        
        # --- التعديل هنا: تفعيل التايمر الفعلي للعد التنازلي ---
        elapsed_sec = (pygame.time.get_ticks() - self.qaid_start_time) // 1000
        rem_sec = max(0, 59 - elapsed_sec)
        time_str = f"00:{rem_sec:02d}"
        time_surf = render_arabic(font_s, time_str, C_WHITE)
        pygame.draw.rect(self.screen, (0, 0, 0), (SCREEN_WIDTH//2 - 35, 25, 70, 30), border_radius=15)
        pygame.draw.rect(self.screen, (50, 50, 50), (SCREEN_WIDTH//2 - 35, 25, 70, 30), width=1, border_radius=15)
        self.screen.blit(time_surf, time_surf.get_rect(center=(SCREEN_WIDTH//2, 40)))

    def draw_action_menus(self):
        chat_icon = pygame.Rect(SCREEN_WIDTH - 80, SCREEN_HEIGHT - 80, 60, 60)
        pygame.draw.circle(self.screen, (100, 100, 120), chat_icon.center, 30)
        self.screen.blit(self.assets.fonts['main'].render("💬", True, C_WHITE), (chat_icon.x+15, chat_icon.y+12))

        if self.engine.phase == GamePhase.PLAYING:
            qaid_icon = pygame.Rect(20, 80, 60, 60)
            pygame.draw.circle(self.screen, C_DANGER, qaid_icon.center, 30)
            self.screen.blit(render_arabic(self.assets.fonts['small'], "قيد", C_WHITE), (qaid_icon.x+15, qaid_icon.y+18))
        else:
            qaid_icon = None

        back_icon = pygame.Rect(20, 20, 50, 50)
        pygame.draw.circle(self.screen, (150, 60, 60), back_icon.center, 25)
        self.screen.blit(self.assets.fonts['small'].render("خروج", True, C_WHITE), (back_icon.x+8, back_icon.y+15))

        active_chat_phrases = []
        if self.show_chat_menu:
            menu_w, menu_h = SCREEN_WIDTH - 40, 280; mx, my = 20, SCREEN_HEIGHT - 360
            pygame.draw.rect(self.screen, (40, 40, 40), (mx, my, menu_w, menu_h), border_radius=15)
            cols, rows = 5, 4; bw, bh = (menu_w - 40) // cols, 50
            for i, phrase in enumerate(CHAT_PHRASES):
                col, row = i % cols, i // cols
                rect = pygame.Rect(mx + 10 + col*(bw+5), my + 15 + row*(bh+10), bw, bh)
                bg_c = (200, 240, 200) if col in (3,4) else (255, 240, 240) if row in (2,3) else (240, 240, 220)
                pygame.draw.rect(self.screen, bg_c, rect, border_radius=8)
                txt = render_arabic(self.assets.fonts['chat'], phrase, C_BTN_TEXT)
                self.screen.blit(txt, txt.get_rect(center=rect.center))
                active_chat_phrases.append({'rect': rect, 'text': phrase})

        self._menu_rects['game_actions'] = (chat_icon, back_icon, active_chat_phrases, qaid_icon)

    def draw_project_spread(self):
        if self.engine.phase == GamePhase.PLAYING and self.engine.trick_count == 2:
            current_p = self.engine.turn
            if current_p == -1: return
            cards_to_show = self.engine.get_declared_project_cards(current_p)
            if not cards_to_show: return

            overlap = 20; total_w = len(cards_to_show) * overlap + 10
            if current_p == 0: sx, sy = SCREEN_WIDTH - 90 - total_w, SCREEN_HEIGHT // 2 + 30
            elif current_p == 1: sx, sy = (SCREEN_WIDTH - total_w) // 2, 140
            elif current_p == 2: sx, sy = 90, SCREEN_HEIGHT // 2 + 30
            else: sx, sy = (SCREEN_WIDTH - total_w) // 2, SCREEN_HEIGHT - 260

            pygame.draw.rect(self.screen, (0,0,0), (sx-5, sy-5, total_w+10, 55), border_radius=8)
            for i, c in enumerate(cards_to_show):
                c_surf = pygame.transform.scale(self.assets.cards[f"{c.rank}_of_{c.suit.name}"], (30, 45))
                self.screen.blit(c_surf, (sx + i*overlap, sy))

    def draw_board(self):
        active_bg = self.assets.bgs.get(self.profile['active_bg'], self.assets.bgs[list(self.assets.bgs.keys())[0]])
        self.screen.blit(active_bg, (0, 0))

        font = self.assets.fonts['main']
        if self.engine.phase == GamePhase.PHASE_1: phase_name = "لفة 1"
        elif self.engine.phase == GamePhase.PHASE_2: phase_name = "لفة 2"
        elif self.engine.phase == GamePhase.GABLAK_PHASE: phase_name = "قبلك"
        elif self.engine.phase == GamePhase.DOUBLING: phase_name = "التدبيل"
        else: phase_name = f"اللعب (دورة {self.engine.trick_count})"

        info_str = f"({phase_name}) {self.engine.bid['type'] or 'شراء'} | Team 1: {self.engine.total_scores[1]} | Team 2: {self.engine.total_scores[2]}"
        self.screen.blit(render_arabic(font, info_str, C_WHITE), (SCREEN_WIDTH//2 - 150, 20))

        for i in range(4):
            x, y = self.avatar_positions[i]
            if not self.is_dealing:
                if i == 1: self.draw_fanned_hand(x, y, len(self.engine.hands[i]), 'top')
                elif i == 2: self.draw_fanned_hand(x, y, len(self.engine.hands[i]), 'left')
                elif i == 0: self.draw_fanned_hand(x, y, len(self.engine.hands[i]), 'right')

            if self.engine.turn == i and len(self.engine.current_trick) < 4 and self.engine.phase != GamePhase.SCORE_SUMMARY and not self.show_qaid_menu:
                elapsed = pygame.time.get_ticks() - self.turn_start_time
                limit = 5000 if i == 3 else 1500
                progress = min(1.0, elapsed / limit)
                pygame.draw.arc(self.screen, C_TIMER_HUMAN if i == 3 else C_TIMER_BOT, (x-45, y-45, 90, 90), math.pi/2, math.pi/2 + (2 * math.pi * (1 - progress)), 6)

            pygame.draw.circle(self.screen, C_AVATAR_BG, (x, y), 40)
            p_name = self.profile['name'] if i == 3 else f"P{i}"
            name_s = render_arabic(self.assets.fonts['small'], p_name, C_WHITE)
            self.screen.blit(name_s, name_s.get_rect(center=(x, y)))

            if self.engine.dealer_idx == i:
                badge_rect = pygame.Rect(0, 0, 50, 22); badge_rect.center = (x, y + 42 if i != 3 else y - 42)
                pygame.draw.rect(self.screen, C_DEALER_BADGE, badge_rect, border_radius=6)
                badge_text = render_arabic(self.assets.fonts['chat'], "موزع", (0, 0, 0)); self.screen.blit(badge_text, badge_text.get_rect(center=badge_rect.center))

        self.draw_chat_bubbles(self.avatar_positions)

    def draw_center_play(self):
        if self.engine.phase == GamePhase.PLAYING:
            offsets = {0: (50, 0), 1: (0, -70), 2: (-50, 0), 3: (0, 70)}
            for item in self.engine.current_trick:
                player_idx, card, ang, dx, dy = item[0], item[1], item[2], item[3], item[4]
                card_key = f"{card.rank}_of_{card.suit.name}"; card_surf = self.assets.cards[card_key]
                rotated_card = pygame.transform.rotate(card_surf, ang)

                base_x = SCREEN_WIDTH // 2 + offsets[player_idx][0] + dx
                base_y = SCREEN_HEIGHT // 2 + offsets[player_idx][1] + dy

                anim = self.card_throw_anims.get(player_idx)
                if anim and anim['card'] == card:
                    elapsed = pygame.time.get_ticks() - anim['start_time']
                    if elapsed < anim['duration']:
                        progress = elapsed / anim['duration']
                        progress = 1 - (1 - progress)**3
                        sx, sy = anim['start_pos']
                        base_x = sx + (base_x - sx) * progress
                        base_y = sy + (base_y - sy) * progress
                        arc = math.sin(progress * math.pi) * -30
                        base_y += arc
                    else:
                        if player_idx in self.card_throw_anims:
                            del self.card_throw_anims[player_idx]

                self.screen.blit(rotated_card, rotated_card.get_rect(center=(base_x, base_y)).topleft)

        elif self.engine.floor_card and self.engine.phase in (GamePhase.PHASE_1, GamePhase.PHASE_2, GamePhase.GABLAK_PHASE):
            card_key = f"{self.engine.floor_card.rank}_of_{self.engine.floor_card.suit.name}"
            self.screen.blit(self.assets.cards[card_key], self.assets.cards[card_key].get_rect(center=(SCREEN_WIDTH//2, SCREEN_HEIGHT//2)).topleft)

    def draw_card_collections(self):
        for anim in self.card_collect_anims[:]:
            elapsed = pygame.time.get_ticks() - anim['start_time']
            if elapsed > anim['duration']:
                self.card_collect_anims.remove(anim)
                continue
            progress = (elapsed / anim['duration']) ** 2

            wx, wy = self.avatar_positions[anim['winner']]
            offsets = {0: (50, 0), 1: (0, -70), 2: (-50, 0), 3: (0, 70)}

            for item in anim['cards']:
                p_idx, card, ang, dx, dy = item[0], item[1], item[2], item[3], item[4]
                card_key = f"{card.rank}_of_{card.suit.name}"
                card_surf = self.assets.cards[card_key]
                rotated_card = pygame.transform.rotate(card_surf, ang)

                start_x = SCREEN_WIDTH // 2 + offsets[p_idx][0] + dx
                start_y = SCREEN_HEIGHT // 2 + offsets[p_idx][1] + dy

                cur_x = start_x + (wx - start_x) * progress
                cur_y = start_y + (wy - start_y) * progress

                self.screen.blit(rotated_card, rotated_card.get_rect(center=(cur_x, cur_y)).topleft)

    def draw_player_hand_and_projects(self):
        if self.engine.phase == GamePhase.SCORE_SUMMARY: return
        if self.is_dealing: return
        my_hand = self.engine.hands[3]
        if not my_hand: return

        overlap = 35; start_x = (SCREEN_WIDTH - ((len(my_hand) - 1) * overlap + 75)) // 2

        self.active_project_buttons = []
        if self.engine.phase == GamePhase.PLAYING and self.engine.trick_count == 1 and self.engine.turn == 3:
            proj_w = 60; proj_h = 35
            total_w = len(PROJECT_PHRASES) * (proj_w + 5) - 5
            bx = (SCREEN_WIDTH - total_w) // 2
            for proj in PROJECT_PHRASES:
                rect = pygame.Rect(bx, SCREEN_HEIGHT - 170, proj_w, proj_h)
                count_declared = self.engine.declared_projects[3].count(proj)
                btn_color = (120, 180, 120) if count_declared > 0 else C_PROJECT_BG
                pygame.draw.rect(self.screen, btn_color, rect, border_radius=6)
                txt_display = f"{proj} x{count_declared}" if count_declared > 1 else proj
                txt_surf = render_arabic(self.assets.fonts['small'], txt_display, C_WHITE)
                self.screen.blit(txt_surf, txt_surf.get_rect(center=rect.center))
                self.active_project_buttons.append({'rect': rect, 'name': proj})
                bx += proj_w + 5

        for i, card in enumerate(my_hand):
            card_surf = self.assets.cards[f"{card.rank}_of_{card.suit.name}"].copy()
            is_preselected = (self.pre_selected_card is not None and card == self.pre_selected_card)
            y_pos = SCREEN_HEIGHT - 140 if is_preselected else (SCREEN_HEIGHT - 120 if self.hovered_card == i else SCREEN_HEIGHT - 100)
            self.screen.blit(card_surf, (start_x + (i * overlap), y_pos))

    def draw_dynamic_buttons(self):
        self.active_buttons = []

        # Auto-pass toggle (visible during bidding/doubling, even when not your turn)
        if self.engine.phase in (GamePhase.PHASE_1, GamePhase.PHASE_2, GamePhase.GABLAK_PHASE, GamePhase.DOUBLING):
            ap_rect = pygame.Rect(SCREEN_WIDTH - 120, 140, 105, 40)
            is_on = self.auto_pass
            bg_ap = (50, 160, 50) if is_on else (60, 60, 70)
            pygame.draw.rect(self.screen, bg_ap, ap_rect, border_radius=8)
            label = "تلقائي: بس"
            txt_ap = render_arabic(self.assets.fonts['small'], label, C_WHITE)
            self.screen.blit(txt_ap, txt_ap.get_rect(center=ap_rect.center))
            self.active_buttons.append({'rect': ap_rect, 'action': 'TOGGLE_AUTO_PASS', 'txt': '', 'data': None})

        if self.engine.turn != 3 or len(self.engine.current_trick) == 4 or self.engine.phase == GamePhase.SCORE_SUMMARY: return

        btns = []
        if self.show_suit_selection and self.engine.phase == GamePhase.PHASE_2:
            if self.engine.floor_card:
                for s in Suit:
                    if s != self.engine.floor_card.suit: btns.append((s.value, 'HAKAM_SUIT', s))
            btns.append(("رجوع", 'CANCEL', None))
        elif self.engine.phase in (GamePhase.PHASE_1, GamePhase.PHASE_2):
            btns = [("بس" if self.engine.phase == GamePhase.PHASE_1 else "ولا", 'PASS', None), ("حكم", 'HAKAM', None), ("صن", 'SUN', None)]
            if self.engine.turn in (self.engine.dealer_idx, (self.engine.dealer_idx + 3) % 4): btns.append(("أشكل", 'ASHKAL', None))
        elif self.engine.phase == GamePhase.GABLAK_PHASE:
            btns = [("بس", 'PASS', None), ("قبلك", 'GABLAK', None)]
        elif self.engine.phase == GamePhase.DOUBLING:
            is_buyer = self.engine.turn == self.engine.bid['bidder']
            btns = [("بس", 'PASS', None)]
            if self.engine.double_level == 1 and not is_buyer: btns.append(("دبل", 'DOUBLE', None))
            elif self.engine.double_level == 2 and is_buyer: btns.append(("ثري", 'THREE', None))
            elif self.engine.double_level == 3 and self.engine.turn == self.engine.doubler_idx: btns.append(("فور", 'FOUR', None))
            elif self.engine.double_level == 4 and is_buyer: btns.append(("قهوة", 'GAHWA', None))

        if not btns: return
        btn_w = (SCREEN_WIDTH - 40 - (len(btns)-1)*10) // len(btns)
        for i, (txt, action, data) in enumerate(btns):
            rect = pygame.Rect(20 + i*(btn_w + 10), SCREEN_HEIGHT - 180, btn_w, 50)
            self.active_buttons.append({'rect': rect, 'action': action, 'txt': txt, 'data': data})
            c = (200, 80, 80) if action in ('PASS', 'CANCEL') else (80, 180, 200) if action == 'SUN' else (200, 180, 80) if action == 'HAKAM' else (150, 80, 200) if action == 'ASHKAL' else (200, 100, 50) if action == 'HAKAM_SUIT' and data in (Suit.HEARTS, Suit.DIAMONDS) else (100, 100, 120) if action == 'HAKAM_SUIT' else (80, 200, 80)
            pygame.draw.rect(self.screen, c, rect, border_radius=10)
            text_surf = render_arabic(self.assets.fonts['small'], txt, C_BTN_TEXT)
            self.screen.blit(text_surf, text_surf.get_rect(center=rect.center))

    def draw_gifts_and_menus(self):
        active_gift_opts = []
        if self.show_gift_menu is not None:
            target = self.show_gift_menu
            tx, ty = self.avatar_positions[target]
            menu_rect = pygame.Rect(tx - 65, ty + 50, 130, 50)
            if target == 3: menu_rect.y = ty - 100
            pygame.draw.rect(self.screen, (30,30,40), menu_rect, border_radius=10)

            gifts = [('☕', 5), ('🌹', 5), ('❤️', 10)]
            for i, (emoji, price) in enumerate(gifts):
                rect = pygame.Rect(menu_rect.x + 5 + i*40, menu_rect.y + 5, 36, 40)
                pygame.draw.rect(self.screen, (50,50,60), rect, border_radius=5)
                try:
                    e_surf = self.assets.fonts['emoji'].render(emoji, True, C_WHITE)
                    self.screen.blit(e_surf, e_surf.get_rect(center=(rect.centerx, rect.centery-5)))
                except:
                    t_surf = render_arabic(self.assets.fonts['small'], emoji, C_WHITE)
                    self.screen.blit(t_surf, t_surf.get_rect(center=(rect.centerx, rect.centery-5)))
                p_surf = render_arabic(self.assets.fonts['chat'], str(price), C_GEM)
                self.screen.blit(p_surf, p_surf.get_rect(center=(rect.centerx, rect.centery+10)))
                active_gift_opts.append({'rect': rect, 'emoji': emoji, 'price': price, 'target': target})

        for anim in self.gift_anims[:]:
            elapsed = pygame.time.get_ticks() - anim['start_time']
            if elapsed > anim['duration']:
                self.active_gifts[anim['target']].append({'emoji': anim['emoji'], 'time': pygame.time.get_ticks()})
                self.gift_anims.remove(anim)
                continue
            progress = elapsed / anim['duration']
            sx, sy = anim['start']
            tx, ty = anim['end']
            cx = sx + (tx - sx) * progress
            cy = sy + (ty - sy) * progress
            try: e_surf = self.assets.fonts['emoji'].render(anim['emoji'], True, C_WHITE)
            except: e_surf = render_arabic(self.assets.fonts['small'], anim['emoji'], C_WHITE)
            self.screen.blit(e_surf, e_surf.get_rect(center=(cx, cy)))

        for p_idx, gifts_list in self.active_gifts.items():
            valid_gifts = [g for g in gifts_list if pygame.time.get_ticks() - g['time'] < 10000]
            self.active_gifts[p_idx] = valid_gifts
            ax, ay = self.avatar_positions[p_idx]
            for i, g in enumerate(valid_gifts):
                try: e_surf = self.assets.fonts['emoji'].render(g['emoji'], True, C_WHITE)
                except: e_surf = render_arabic(self.assets.fonts['small'], g['emoji'], C_WHITE)
                self.screen.blit(e_surf, e_surf.get_rect(center=(ax + 35 + i*15, ay - 35)))

        return active_gift_opts

    def run(self):
        running = True
        while running:
            mouse_x, mouse_y = pygame.mouse.get_pos()

            if self.app_state == AppState.MAIN_MENU:
                self.draw_main_menu()
            elif self.app_state == AppState.SHOP:
                self.draw_shop()
            elif self.app_state == AppState.PROFILE:
                self.draw_profile()
            elif self.app_state == AppState.IN_GAME:
                self.update_timers_and_bots()

                self.hovered_card = -1
                if self.engine.phase == GamePhase.PLAYING and not self.show_qaid_menu:
                    overlap = 35; start_x = (SCREEN_WIDTH - ((len(self.engine.hands[3]) - 1) * overlap + 75)) // 2
                    for i in reversed(range(len(self.engine.hands[3]))):
                        if pygame.Rect(start_x + (i * overlap), SCREEN_HEIGHT - 140, 75 if i == len(self.engine.hands[3]) - 1 else overlap, 135).collidepoint(mouse_x, mouse_y):
                            self.hovered_card = i; break

                self.draw_board()
                if self.is_dealing:
                    self._draw_dealing_animation()
                self.draw_project_spread()
                self.draw_card_collections()
                self.draw_center_play()
                self.draw_player_hand_and_projects()
                self.draw_dynamic_buttons()
                self.active_gift_opts = self.draw_gifts_and_menus()
                self.draw_action_menus()
                
                if self.show_qaid_menu:
                    self.draw_qaid_menu()
                    
                self.draw_score_summary()

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False

                elif event.type == pygame.MOUSEWHEEL:
                    if self.app_state == AppState.IN_GAME and self.show_qaid_menu:
                        self.qaid_scroll_y += event.y * 30
                        if self.qaid_scroll_y > 0: self.qaid_scroll_y = 0
                        if self.qaid_scroll_y < self.qaid_max_scroll: self.qaid_scroll_y = self.qaid_max_scroll

                elif event.type == pygame.MOUSEBUTTONDOWN:
                    if self.app_state == AppState.MAIN_MENU:
                        rects = self._menu_rects.get('main')
                        if rects:
                            b_quick, b_ranked, b_rooms, b_prof = rects
                            if b_quick.collidepoint(mouse_x, mouse_y) or b_ranked.collidepoint(mouse_x, mouse_y):
                                self.engine = BalootEngine()
                                self._setup_dealing_animation()
                                self._last_total_cards = sum(len(h) for h in self.engine.hands)
                                self.app_state = AppState.IN_GAME
                            elif b_prof.collidepoint(mouse_x, mouse_y):
                                self.app_state = AppState.PROFILE
                            elif b_rooms.collidepoint(mouse_x, mouse_y):
                                self.app_state = AppState.SHOP

                    elif self.app_state == AppState.SHOP:
                        rects = self._menu_rects.get('shop')
                        if rects:
                            bg_btns, b_back = rects
                            if b_back.collidepoint(mouse_x, mouse_y):
                                self.app_state = AppState.MAIN_MENU
                            for btn in bg_btns:
                                if btn['rect'].collidepoint(mouse_x, mouse_y):
                                    self.profile['active_bg'] = btn['bg_name']

                    elif self.app_state == AppState.PROFILE:
                        b_back = self._menu_rects.get('profile')
                        if b_back and b_back.collidepoint(mouse_x, mouse_y):
                            self.app_state = AppState.MAIN_MENU

                    elif self.app_state == AppState.IN_GAME:
                        
                        # --- إعدادات تفاعل القيد ---
                        if self.show_qaid_menu:
                            if self.qaid_rects['close'] and self.qaid_rects['close'].collidepoint(mouse_x, mouse_y):
                                self.show_qaid_menu = False
                                continue
                            
                            if mouse_y < 80:
                                continue
                                
                            for r_opt in self.qaid_rects['reasons']:
                                if r_opt['rect'].collidepoint(mouse_x, mouse_y):
                                    self.qaid_data['reason'] = r_opt['reason']
                                    
                            for c_opt in self.qaid_rects['cards']:
                                if c_opt['rect'].collidepoint(mouse_x, mouse_y):
                                    if c_opt['card'] in self.qaid_data['cards']:
                                        self.qaid_data['cards'].remove(c_opt['card'])
                                    else:
                                        if len(self.qaid_data['cards']) < 2:
                                            self.qaid_data['cards'].append(c_opt['card'])
                                            
                            if self.qaid_rects['submit'] and self.qaid_rects['submit'].collidepoint(mouse_x, mouse_y):
                                self.show_qaid_menu = False
                                
                                if not self.engine.mistakes:
                                    self.add_chat_bubble(3, "اللعب كان صحيح! قيد خاسر")
                                    self.engine.finalize_round(forced_win_team=2)
                                    continue
                                
                                selected_cards = self.qaid_data['cards']
                                qaid_valid = False
                                
                                for mistake in self.engine.mistakes:
                                    played_c = mistake['played_card']
                                    legal_held = mistake['legal_cards_held']
                                    
                                    if played_c in selected_cards:
                                        qaid_valid = True
                                        if len(selected_cards) > 1:
                                            other_card = selected_cards[0] if selected_cards[1] == played_c else selected_cards[1]
                                            if other_card not in legal_held:
                                                qaid_valid = False
                                        break
                                        
                                if qaid_valid:
                                    self.add_chat_bubble(3, "صادوه! قيد صحيح")
                                    self.engine.finalize_round(forced_win_team=1) 
                                else:
                                    self.add_chat_bubble(3, "اختيار خاطئ! قيد خاسر")
                                    self.engine.finalize_round(forced_win_team=2) 
                                
                            continue

                        game_rects = self._menu_rects.get('game_actions')
                        if not game_rects:
                            continue

                        chat_icon, back_icon, chat_opts, qaid_icon = game_rects

                        if back_icon.collidepoint(mouse_x, mouse_y):
                            self.app_state = AppState.MAIN_MENU
                            continue

                        if qaid_icon and qaid_icon.collidepoint(mouse_x, mouse_y):
                            self.show_qaid_menu = True
                            self.qaid_data = {'reason': None, 'cards': []}
                            self.qaid_scroll_y = 0 
                            self.qaid_start_time = pygame.time.get_ticks() 
                            continue

                        if self.show_gift_menu is not None:
                            gift_clicked = False
                            for opt in self.active_gift_opts:
                                if opt['rect'].collidepoint(mouse_x, mouse_y):
                                    if self.profile['gems'] >= opt['price']:
                                        self.profile['gems'] -= opt['price']
                                        self.gift_anims.append({
                                            'start_time': pygame.time.get_ticks(), 'duration': 600,
                                            'emoji': opt['emoji'],
                                            'start': self.avatar_positions[3],
                                            'end': self.avatar_positions[opt['target']],
                                            'target': opt['target']
                                        })
                                    self.show_gift_menu = None
                                    gift_clicked = True
                                    break
                            if not gift_clicked:
                                self.show_gift_menu = None
                            continue

                        gift_menu_opened = False
                        for i in range(4):
                            if i != 3:
                                ax, ay = self.avatar_positions[i]
                                if math.hypot(mouse_x - ax, mouse_y - ay) < 40:
                                    self.show_gift_menu = i
                                    gift_menu_opened = True
                                    break
                        if gift_menu_opened:
                            continue

                        if chat_icon.collidepoint(mouse_x, mouse_y):
                            self.show_chat_menu = not self.show_chat_menu
                            continue

                        if self.show_chat_menu:
                            for opt in chat_opts:
                                if opt['rect'].collidepoint(mouse_x, mouse_y):
                                    msg = opt['text']
                                    self.add_chat_bubble(3, msg)
                                    self.show_chat_menu = False
                                    
                                    partner = 1; opp1 = 0; opp2 = 2
                                    delay = random.randint(800, 1500)
                                    if msg in ["السلام عليكم", "وعليكم السلام"]:
                                        if not self.has_replied_greeting:
                                            self.schedule_bot_chat(opp1, "وعليكم السلام", delay)
                                            self.schedule_bot_chat(partner, "ارحب", delay + 500)
                                            self.has_replied_greeting = True
                                    elif msg == "بسرعة!!":
                                        self.schedule_bot_chat(opp2, "طيار!!", delay)
                                    elif msg == "سموحة":
                                        self.schedule_bot_chat(partner, random.choice(["فدا", "ابشر بالعوض"]), delay)
                                    elif msg == "كفو خوي!":
                                        self.schedule_bot_chat(partner, random.choice(["كفوك الطيب", "تسلم خوي"]), delay)
                                    
                                    break
                            self.show_chat_menu = False
                            continue

                        # Auto-pass toggle
                        for btn in self.active_buttons:
                            if btn['action'] == 'TOGGLE_AUTO_PASS' and btn['rect'].collidepoint(mouse_x, mouse_y):
                                self.auto_pass = not self.auto_pass
                                if self.auto_pass:
                                    self.add_chat_bubble(3, "تفعيل التمرير التلقائي")
                                break
                        else:
                            # Pre-select card (click even when not your turn)
                            if self.engine.phase == GamePhase.PLAYING and self.hovered_card != -1 and not self.show_qaid_menu:
                                if self.engine.turn != 3:
                                    clicked_card = self.engine.hands[3][self.hovered_card]
                                    if self.pre_selected_card == clicked_card:
                                        self.pre_selected_card = None
                                    else:
                                        self.pre_selected_card = clicked_card
                                    continue

                            if self.engine.turn == 3 and len(self.engine.current_trick) < 4:
                                if self.engine.phase == GamePhase.PLAYING:
                                    project_clicked = False
                                    for pb in self.active_project_buttons:
                                        if pb['rect'].collidepoint(mouse_x, mouse_y):
                                            if self.engine.declare_project(3, pb['name']):
                                                self.add_chat_bubble(3, pb['name'])
                                                if pb['name'] == 'سرا':
                                                    self.schedule_bot_chat(1, "طرا", 1000)
                                                elif pb['name'] in ['خمسين', 'مية', 'أربعمية']:
                                                    self.schedule_bot_chat(1, "تسلم ليا", 1000)
                                            project_clicked = True
                                            break

                                    if not project_clicked and self.hovered_card != -1:
                                        self.perform_play_card(3, self.hovered_card)
                                        self.pre_selected_card = None
                                else:
                                    for btn in self.active_buttons:
                                        if btn['rect'].collidepoint(mouse_x, mouse_y):
                                            if btn['action'] == 'HAKAM' and self.engine.phase == GamePhase.PHASE_2:
                                                self.show_suit_selection = True
                                            elif btn['action'] == 'CANCEL':
                                                self.show_suit_selection = False
                                            elif btn['action'] == 'HAKAM_SUIT':
                                                self.add_chat_bubble(3, f"حكم {btn['data'].value}")
                                                self.show_suit_selection = False
                                                self.engine.process_bidding('HAKAM', 3, btn['data'])
                                            elif self.engine.phase == GamePhase.DOUBLING:
                                                self.add_chat_bubble(3, btn['txt'])
                                                self.engine.process_doubling(btn['action'], 3)
                                            else:
                                                self.add_chat_bubble(3, btn['txt'])
                                                self.engine.process_bidding(btn['action'], 3)
                                            break

            pygame.display.flip()
            self.clock.tick(60)

        pygame.quit()
        sys.exit()

if __name__ == "__main__":
    game = GameUI()
    game.run()