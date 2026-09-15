package app.lovekit.bridge.pack

/**
 * MiniJson — a tiny STRICT JSON parser for one job: reading LoveKit
 * `pack.json` manifests. Dependency-free (org.json is an Android stub on
 * plain JVM, so it can't be unit-tested; this can), with hard caps against
 * hostile input: max depth, max input size, no trailing garbage.
 */
sealed interface JsonValue {
    data class Obj(val map: Map<String, JsonValue>) : JsonValue
    data class Arr(val items: List<JsonValue>) : JsonValue
    data class Str(val value: String) : JsonValue
    data class Num(val value: Double) : JsonValue
    data class Bool(val value: Boolean) : JsonValue
    data object Null : JsonValue
}

class JsonParseException(message: String) : Exception(message)

object MiniJson {
    const val MAX_DEPTH = 32
    const val MAX_INPUT = 300_000

    fun parse(input: String): JsonValue {
        if (input.length > MAX_INPUT) throw JsonParseException("input too large")
        val p = Parser(input)
        p.ws()
        val v = p.value(0)
        p.ws()
        if (!p.eof()) throw JsonParseException("trailing characters")
        return v
    }

    private class Parser(val s: String) {
        var i = 0
        fun eof() = i >= s.length
        fun ws() {
            while (!eof() && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) i++
        }
        fun expect(c: Char) {
            if (eof() || s[i] != c) throw JsonParseException("expected '$c' at $i")
            i++
        }
        fun value(depth: Int): JsonValue {
            if (depth > MAX_DEPTH) throw JsonParseException("too deeply nested")
            if (eof()) throw JsonParseException("unexpected end")
            return when (s[i]) {
                '{' -> obj(depth)
                '[' -> arr(depth)
                '"' -> JsonValue.Str(str())
                't' -> lit("true", JsonValue.Bool(true))
                'f' -> lit("false", JsonValue.Bool(false))
                'n' -> lit("null", JsonValue.Null)
                '-', in '0'..'9' -> num()
                else -> throw JsonParseException("unexpected '${s[i]}' at $i")
            }
        }
        fun obj(depth: Int): JsonValue.Obj {
            expect('{'); ws()
            val map = LinkedHashMap<String, JsonValue>()
            if (!eof() && s[i] == '}') {
                i++
                return JsonValue.Obj(map)
            }
            while (true) {
                ws()
                if (eof() || s[i] != '"') throw JsonParseException("expected key at $i")
                val k = str()
                ws(); expect(':'); ws()
                map[k] = value(depth + 1)
                ws()
                if (eof()) throw JsonParseException("unterminated object")
                if (s[i] == ',') {
                    i++
                    continue
                }
                if (s[i] == '}') {
                    i++
                    return JsonValue.Obj(map)
                }
                throw JsonParseException("expected ',' or '}' at $i")
            }
        }
        fun arr(depth: Int): JsonValue.Arr {
            expect('['); ws()
            val items = ArrayList<JsonValue>()
            if (!eof() && s[i] == ']') {
                i++
                return JsonValue.Arr(items)
            }
            while (true) {
                ws()
                items.add(value(depth + 1))
                ws()
                if (eof()) throw JsonParseException("unterminated array")
                if (s[i] == ',') {
                    i++
                    continue
                }
                if (s[i] == ']') {
                    i++
                    return JsonValue.Arr(items)
                }
                throw JsonParseException("expected ',' or ']' at $i")
            }
        }
        fun str(): String {
            expect('"')
            val out = StringBuilder()
            while (true) {
                if (eof()) throw JsonParseException("unterminated string")
                val c = s[i++]
                if (c == '"') return out.toString()
                if (c == '\\') {
                    if (eof()) throw JsonParseException("bad escape")
                    when (val e = s[i++]) {
                        '"', '\\', '/' -> out.append(e)
                        'b' -> out.append('\b')
                        'f' -> out.append('\u000C')
                        'n' -> out.append('\n')
                        'r' -> out.append('\r')
                        't' -> out.append('\t')
                        'u' -> {
                            if (i + 4 > s.length) throw JsonParseException("bad \\u escape")
                            val hex = s.substring(i, i + 4)
                            val code = hex.toIntOrNull(16) ?: throw JsonParseException("bad \\u escape")
                            i += 4
                            out.append(code.toChar())
                        }
                        else -> throw JsonParseException("bad escape '\\$e'")
                    }
                } else if (c < ' ') {
                    throw JsonParseException("unescaped control character")
                } else {
                    out.append(c)
                }
            }
        }
        fun lit(word: String, v: JsonValue): JsonValue {
            if (!s.startsWith(word, i)) throw JsonParseException("bad literal at $i")
            i += word.length
            return v
        }
        fun num(): JsonValue.Num {
            val start = i
            if (!eof() && s[i] == '-') i++
            while (!eof() && s[i] in '0'..'9') i++
            if (!eof() && s[i] == '.') {
                i++
                while (!eof() && s[i] in '0'..'9') i++
            }
            if (!eof() && (s[i] == 'e' || s[i] == 'E')) {
                i++
                if (!eof() && (s[i] == '+' || s[i] == '-')) i++
                while (!eof() && s[i] in '0'..'9') i++
            }
            val n = s.substring(start, i).toDoubleOrNull() ?: throw JsonParseException("bad number")
            if (!n.isFinite()) throw JsonParseException("non-finite number")
            return JsonValue.Num(n)
        }
    }
}

/** Convenience accessors that fail soft (null) instead of throwing. */
fun JsonValue.obj(): Map<String, JsonValue>? = (this as? JsonValue.Obj)?.map
fun JsonValue.arr(): List<JsonValue>? = (this as? JsonValue.Arr)?.items
fun JsonValue.str(): String? = (this as? JsonValue.Str)?.value
fun JsonValue.num(): Double? = (this as? JsonValue.Num)?.value
