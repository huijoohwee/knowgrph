import React, { useState } from 'react';
import { Network, FileText, Sparkles, GitBranch, Database } from 'lucide-react';

const GraphRAGParser = () => {
  const [step, setStep] = useState(0);
  const text = "Singapore is a city-state in Southeast Asia. It has a population of about 5.9 million and is known for its financial hub, Changi Airport, and future development projects.";
  
  const steps = [
    {
      name: "NLTK Preprocessing",
      icon: FileText,
      input: text,
      output: {
        tokens: ["Singapore", "city-state", "Southeast", "Asia", "population", "5.9", "million", "known", "financial", "hub", "Changi", "Airport", "future", "development", "projects"],
        lemmas: ["singapore", "city-state", "southeast", "asia", "population", "million", "know", "financial", "hub", "changi", "airport", "future", "development", "project"]
      },
      code: "# stopwords removed, lemmatized\nfrom nltk.corpus import stopwords\nfrom nltk.stem import WordNetLemmatizer"
    },
    {
      name: "HF Tokenizers",
      icon: Sparkles,
      input: "Tokenization for LLM compatibility",
      output: {
        subwords: ["Sing", "apore", "is", "a", "city", "-", "state", "in", "South", "east", "Asia"],
        count: "Original: 29 tokens | Subword: 35 tokens"
      },
      code: "from tokenizers import Tokenizer\ntok = Tokenizer.from_pretrained('gpt2')"
    },
    {
      name: "spaCy NER & POS",
      icon: Database,
      input: text,
      output: {
        entities: [
          { text: "Singapore", label: "GPE" },
          { text: "Southeast Asia", label: "LOC" },
          { text: "5.9 million", label: "QUANTITY" },
          { text: "Changi Airport", label: "FAC" }
        ],
        pos: "Singapore/PROPN is/AUX a/DET city-state/NOUN"
      },
      code: "import spacy\nnlp = spacy.load('en_core_web_sm')\ndoc = nlp(text)"
    },
    {
      name: "Triple Extraction",
      icon: GitBranch,
      input: "Semantic relationships from text",
      output: {
        triples: [
          "(Singapore, is-a, city-state)",
          "(Singapore, located-in, Southeast Asia)",
          "(Singapore, has-population, 5.9 million)",
          "(Singapore, known-for, financial hub)",
          "(Singapore, known-for, Changi Airport)"
        ]
      },
      code: "# OpenIE or custom extraction\n(subject, relation, object)"
    },
    {
      name: "Graph Construction",
      icon: Network,
      input: "Build knowledge graph",
      output: {
        nodes: ["Singapore", "city-state", "Southeast Asia", "5.9M pop", "Changi Airport", "financial hub"],
        edges: 5,
        communities: 2
      },
      code: "import networkx as nx\nG = nx.Graph()\nG.add_edges_from(triples)"
    }
  ];

  const currentStep = steps[step];
  const Icon = currentStep.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Network className="w-10 h-10 text-purple-400" />
            GraphRAG Pipeline Demo
          </h1>
          <p className="text-purple-200 mb-8">Minimum viable FOSS stack for knowledge graph extraction</p>

          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {steps.map((s, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                  step === i
                    ? 'bg-purple-500 text-white shadow-lg scale-105'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {i + 1}. {s.name}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-black/30 rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Icon className="w-6 h-6 text-purple-400" />
                <h3 className="text-xl font-bold text-white">{currentStep.name}</h3>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 mb-4">
                <pre className="text-sm text-green-300 overflow-x-auto">{currentStep.code}</pre>
              </div>
              <div className="text-sm text-purple-200">
                <strong>Input:</strong>
                <p className="mt-2 text-white/80 italic">{typeof currentStep.input === 'string' ? currentStep.input : text}</p>
              </div>
            </div>

            <div className="bg-black/30 rounded-xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Output</h3>
              <div className="space-y-3">
                {currentStep.name === "NLTK Preprocessing" && (
                  <>
                    <div>
                      <strong className="text-purple-300">Tokens:</strong>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {currentStep.output.tokens.map((t, i) => (
                          <span key={i} className="px-2 py-1 bg-blue-500/30 text-blue-200 rounded text-sm">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <strong className="text-purple-300">Lemmas:</strong>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {currentStep.output.lemmas.slice(0, 8).map((l, i) => (
                          <span key={i} className="px-2 py-1 bg-green-500/30 text-green-200 rounded text-sm">{l}</span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                
                {currentStep.name === "HF Tokenizers" && (
                  <>
                    <div>
                      <strong className="text-purple-300">Subword Tokens:</strong>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {currentStep.output.subwords.map((s, i) => (
                          <span key={i} className="px-2 py-1 bg-orange-500/30 text-orange-200 rounded text-sm">{s}</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-white/70 text-sm mt-2">{currentStep.output.count}</p>
                  </>
                )}

                {currentStep.name === "spaCy NER & POS" && (
                  <>
                    <div>
                      <strong className="text-purple-300">Named Entities:</strong>
                      {currentStep.output.entities.map((e, i) => (
                        <div key={i} className="mt-2 flex items-center gap-2">
                          <span className="px-3 py-1 bg-pink-500/30 text-pink-200 rounded">{e.text}</span>
                          <span className="text-xs text-white/50">{e.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <strong className="text-purple-300">POS Example:</strong>
                      <p className="text-white/70 text-sm mt-1 font-mono">{currentStep.output.pos}</p>
                    </div>
                  </>
                )}

                {currentStep.name === "Triple Extraction" && (
                  <div>
                    <strong className="text-purple-300">Extracted Triples:</strong>
                    {currentStep.output.triples.map((t, i) => (
                      <div key={i} className="mt-2 text-sm text-cyan-200 font-mono bg-cyan-900/20 p-2 rounded">{t}</div>
                    ))}
                  </div>
                )}

                {currentStep.name === "Graph Construction" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-purple-500/20 p-3 rounded-lg">
                        <div className="text-2xl font-bold text-white">{currentStep.output.nodes.length}</div>
                        <div className="text-xs text-purple-200">Nodes</div>
                      </div>
                      <div className="bg-blue-500/20 p-3 rounded-lg">
                        <div className="text-2xl font-bold text-white">{currentStep.output.edges}</div>
                        <div className="text-xs text-blue-200">Edges</div>
                      </div>
                      <div className="bg-green-500/20 p-3 rounded-lg">
                        <div className="text-2xl font-bold text-white">{currentStep.output.communities}</div>
                        <div className="text-xs text-green-200">Communities</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {currentStep.output.nodes.map((n, i) => (
                        <span key={i} className="px-3 py-2 bg-indigo-500/30 text-indigo-200 rounded-lg text-sm">{n}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 bg-black/20 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-3">FOSS Stack References</h3>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <a href="https://github.com/nltk/nltk" className="text-purple-300 hover:text-purple-200">→ NLTK (preprocessing)</a>
              <a href="https://github.com/huggingface/tokenizers" className="text-purple-300 hover:text-purple-200">→ HuggingFace Tokenizers</a>
              <a href="https://github.com/explosion/spaCy" className="text-purple-300 hover:text-purple-200">→ spaCy (NER, POS)</a>
              <a href="https://github.com/networkx/networkx" className="text-purple-300 hover:text-purple-200">→ NetworkX (graphs)</a>
              <a href="https://github.com/google/sentencepiece" className="text-purple-300 hover:text-purple-200">→ SentencePiece (multilingual)</a>
              <a href="https://github.com/karpathy/minbpe" className="text-purple-300 hover:text-purple-200">→ minbpe (educational BPE)</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphRAGParser;