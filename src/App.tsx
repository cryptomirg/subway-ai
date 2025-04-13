import React, { useState, useEffect, useRef } from 'react';
import { Send, Sandwich, ChevronRight, Mic, MicOff, ArrowRight } from 'lucide-react';
import OpenAI from 'openai';

interface Message {
  text: string;
  isUser: boolean;
}

interface ConversationState {
  stage: 'initial' | 'usual_order' | 'mood' | 'preferences' | 'allergies' | 'final';
  usualOrder?: string;
  mood?: string;
  preferences?: {
    spicy: boolean;
    vegetarian: boolean;
    favoriteIngredients: string[];
  };
  allergies?: string[];
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
  item(index: number): SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    { text: "What's your usual Subway order?", isUser: false }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>({ stage: 'initial' });
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [finalRecommendation, setFinalRecommendation] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        handleSubmit(new Event('submit') as any, transcript);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const getNextQuestion = async (state: ConversationState) => {
    try {
      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a Subway sandwich expert asking questions to understand the customer's preferences.
            Ask ONLY ONE direct question based on the conversation stage:
            
            Stages and questions:
            1. initial: "What's your usual Subway order?"
            2. usual_order: "What are you in the mood for today?"
            3. mood: "Do you prefer spicy or mild flavors?"
            4. preferences: "Any dietary restrictions or allergies?"
            5. allergies: "Is there anything else I should know about your preferences?"
            6. final: [Process and display recommendation]
            
            Keep questions short and direct. No extra text or explanations.`
          },
          {
            role: "user",
            content: `Current stage: ${state.stage}`
          }
        ],
        model: "gpt-4o-mini",
      });

      return completion.choices[0].message.content || "What's your usual Subway order?";
    } catch (error) {
      console.error('Error getting next question:', error);
      return "What's your usual Subway order?";
    }
  };

  const getFinalRecommendation = async (state: ConversationState) => {
    try {
      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a professional chef specializing in sandwich creation, with deep knowledge of flavor combinations and ingredient pairings.
            Create a delicious and sensible Subway sandwich recommendation based on:
            - Usual Order: ${state.usualOrder}
            - Current Mood: ${state.mood}
            - Preferences: ${JSON.stringify(state.preferences)}
            - Allergies: ${state.allergies?.join(', ') || 'none'}
            
            AVAILABLE INGREDIENTS:
            
            🥖 BREADS:
            - Italian (White)
            - Hearty Multigrain
            - Italian Herbs & Cheese
            - Flatbread
            - Artisan Flatbread
            - Wrap (Tomato Basil, Spinach, or Plain)
            - Gluten-Free Bread (in select locations)
            
            🥩 PROTEINS:
            - Black Forest Ham
            - Oven-Roasted Turkey
            - Roast Beef
            - Steak (Seasoned Shaved Beef)
            - Rotisserie-Style Chicken
            - Grilled Chicken Strips
            - Meatballs (in Marinara)
            - Tuna (mixed with mayo)
            - Genoa Salami
            - Spicy Pepperoni
            - Capicola
            - Bacon (Strips)
            - Cold Cut Combo (Bologna, Salami, Ham)
            - Chicken Teriyaki (Sweet Onion Glazed)
            - Pastrami (limited locations)
            - Veggie Patty (Plant-based patty)
            
            🧀 CHEESES:
            - American
            - Monterey Cheddar (shredded)
            - Pepper Jack
            - Provolone
            - Swiss
            - Mozzarella (limited locations)
            - Vegan Cheese (some markets)
            
            🥬 VEGETABLES:
            - Lettuce (Shredded Iceberg)
            - Spinach
            - Tomatoes
            - Cucumbers
            - Green Peppers
            - Red Onions
            - Pickles
            - Jalapeños
            - Banana Peppers
            - Black Olives
            - Avocado (smashed or sliced)
            
            🥫 SAUCES & DRESSINGS:
            - Mayonnaise
            - Light Mayonnaise
            - Mustard (Yellow)
            - Spicy Brown Mustard
            - Honey Mustard
            - Chipotle Southwest
            - Ranch
            - Sweet Onion
            - Buffalo Sauce
            - BBQ Sauce
            - Oil
            - Vinegar (Red Wine)
            - Subway Vinaigrette
            - Creamy Sriracha
            - Caesar
            - Teriyaki Glaze
            - Garlic Aioli
            - Baja Chipotle
            - Peppercorn Ranch
            - Green Goddess (select markets)
            
            🌶️ SEASONINGS:
            - Salt
            - Black Pepper
            - Parmesan Cheese (grated)
            - Oregano
            - Crushed Red Pepper Flakes
            
            IMPORTANT RULES:
            1. NEVER combine seafood (tuna) with other proteins
            2. NEVER mix multiple proteins unless they naturally complement each other (e.g., turkey and ham)
            3. Consider classic flavor combinations that are proven to work well together
            4. Ensure all ingredients complement each other and create a balanced flavor profile
            5. Respect traditional sandwich-making principles
            6. Only use ingredients from the above list
            7. Choose bread that complements the fillings (e.g., hearty breads for heavy fillings)
            8. Select sauces that enhance, not overpower, the main flavors
            9. Include a balanced mix of vegetables for texture and freshness
            
            Format the recommendation in this exact structure:
            
            🥪 [Creative but sensible sandwich name]
            
            🍞 Bread: [type that complements the fillings]
            🥩 Protein: [single protein or complementary protein pair]
            🧀 Cheese: [type that pairs well with the protein]
            🥬 Veggies: [selection that enhances the overall flavor]
            🥫 Sauces: [sauces that create a harmonious flavor profile]
            🌶️ Seasonings: [seasonings that enhance the main flavors]
            🔥 Toasting: [preference based on ingredients]
            
            [Brief explanation of the flavor profile and why these ingredients work well together]`
          },
          {
            role: "user",
            content: "Please provide a sandwich recommendation based on the above information."
          }
        ],
        model: "gpt-4o-mini",
      });

      return completion.choices[0].message.content || "I'm having trouble thinking of a recommendation right now. Please try again!";
    } catch (error) {
      console.error('Error getting recommendation:', error);
      return "I'm having trouble connecting to the AI right now. Please try again later!";
    }
  };

  const handleSubmit = async (e: React.FormEvent, voiceInput?: string) => {
    e.preventDefault();
    const userInput = voiceInput || input;
    if (!userInput.trim()) return;

    const userMessage = { text: userInput, isUser: true };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);

    try {
      let nextState = { ...conversationState };
      let response = '';

      switch (conversationState.stage) {
        case 'initial':
          nextState = { ...nextState, stage: 'usual_order', usualOrder: userInput };
          response = await getNextQuestion(nextState);
          break;
        case 'usual_order':
          nextState = { ...nextState, stage: 'mood', mood: userInput };
          response = await getNextQuestion(nextState);
          break;
        case 'mood':
          nextState = { 
            ...nextState, 
            stage: 'preferences',
            preferences: {
              spicy: userInput.toLowerCase().includes('spicy'),
              vegetarian: userInput.toLowerCase().includes('vegetarian') || userInput.toLowerCase().includes('veggie'),
              favoriteIngredients: []
            }
          };
          response = await getNextQuestion(nextState);
          break;
        case 'preferences':
          nextState = { ...nextState, stage: 'allergies' };
          response = await getNextQuestion(nextState);
          break;
        case 'allergies':
          nextState = { ...nextState, stage: 'final' };
          const recommendation = await getFinalRecommendation(nextState);
          setFinalRecommendation(recommendation);
          setShowRecommendation(true);
          // Reset conversation after recommendation
          nextState = { stage: 'initial' };
          break;
      }

      setConversationState(nextState);
      if (!showRecommendation) {
        setMessages(prev => [...prev, { text: response, isUser: false }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        text: "I'm having trouble with our conversation. Please try again!", 
        isUser: false 
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const startConversation = () => {
    setShowWelcome(false);
  };

  if (showWelcome) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#009B3A]/10 to-[#FFC72C]/10 flex items-center justify-center">
        <div className="subway-card max-w-2xl w-full mx-4">
          <div className="bg-[#009B3A] p-8 text-center">
            <Sandwich className="text-white animate-subway-bounce mx-auto mb-4" size={48} />
            <h1 className="text-3xl font-bold text-white mb-2">Subway AI Assistant</h1>
            <p className="text-white text-lg mb-6">Let's create your perfect sandwich!</p>
          </div>
          <div className="p-8 text-center">
            <p className="text-gray-700 mb-8 text-lg">
              I'll help you build the perfect sandwich by understanding your preferences and current mood. 
              Just answer a few questions, and I'll create a personalized recommendation just for you!
            </p>
            <button
              onClick={startConversation}
              className="subway-button text-lg px-8 py-4 flex items-center gap-2 mx-auto"
            >
              Build Your Perfect Sandwich
              <ArrowRight size={24} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showRecommendation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#009B3A]/10 to-[#FFC72C]/10 flex items-center justify-center p-4">
        <div className="subway-card max-w-2xl w-full">
          <div className="bg-[#009B3A] p-6 text-center">
            <Sandwich className="text-white animate-subway-bounce mx-auto mb-4" size={48} />
            <h1 className="text-2xl font-bold text-white">Your Perfect Sandwich</h1>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-white rounded-lg p-6 space-y-4">
              {finalRecommendation.split('\n\n').map((section, index) => (
                <div key={index} className="space-y-2">
                  {section.split('\n').map((line, lineIndex) => (
                    <p key={lineIndex} className="text-gray-800">
                      {line}
                    </p>
                  ))}
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setShowRecommendation(false);
                setMessages([{ text: "What's your usual Subway order?", isUser: false }]);
                setConversationState({ stage: 'initial' });
              }}
              className="subway-button w-full"
            >
              Create Another Sandwich
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#009B3A]/10 to-[#FFC72C]/10">
      <div className="max-w-2xl mx-auto p-4">
        <div className="subway-card">
          {/* Header */}
          <div className="bg-[#009B3A] p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sandwich className="text-white animate-subway-bounce" size={28} />
              <h1 className="text-2xl font-bold text-white">Subway AI Assistant</h1>
            </div>
            <div className="text-white text-sm">Eat Fresh®</div>
          </div>

          {/* Chat Messages */}
          <div className="h-[500px] overflow-y-auto p-6 space-y-4 bg-gray-50">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl ${
                    message.isUser
                      ? 'bg-[#009B3A] text-white rounded-br-none'
                      : 'bg-white text-gray-800 rounded-bl-none shadow-sm'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-800 p-4 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#009B3A] rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-[#009B3A] rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-[#009B3A] rounded-full animate-bounce delay-200" />
                </div>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tell me how you're feeling..."
                className="subway-input"
              />
              <button
                type="button"
                onClick={toggleListening}
                className={`subway-button ${isListening ? 'bg-red-500 hover:bg-red-600' : ''}`}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button
                type="submit"
                className="subway-button"
              >
                <Send size={20} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;