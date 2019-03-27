


/*jsbn start*/
// Copyright (c) 2005  Tom Wu
// All Rights Reserved.
// See "LICENSE" for details.

// Basic JavaScript BN library - subset useful for RSA encryption.

// Bits per digit
var dbits;

// JavaScript engine analysis
var canary = 0xdeadbeefcafe;
var j_lm = ((canary & 0xffffff) == 0xefcafe);

// (public) Constructor
function BigInteger(a, b, c) {
  if (a != null)
    if ("number" == typeof a) this.fromNumber(a, b, c);
    else if (b == null && "string" != typeof a) this.fromString(a, 256);
    else this.fromString(a, b);
}

// return new, unset BigInteger
function nbi() { return new BigInteger(null); }

// am: Compute w_j += (x*this_i), propagate carries,
// c is initial carry, returns final carry.
// c < 3*dvalue, x < 2*dvalue, this_i < dvalue
// We need to select the fastest one that works in this environment.

// am1: use a single mult and divide to get the high bits,
// max digit bits should be 26 because
// max internal value = 2*dvalue^2-2*dvalue (< 2^53)
function am1(i, x, w, j, c, n) {
  while (--n >= 0) {
    var v = x * this[i++] + w[j] + c;
    c = Math.floor(v / 0x4000000);
    w[j++] = v & 0x3ffffff;
  }
  return c;
}
// am2 avoids a big mult-and-extract completely.
// Max digit bits should be <= 30 because we do bitwise ops
// on values up to 2*hdvalue^2-hdvalue-1 (< 2^31)
function am2(i, x, w, j, c, n) {
  var xl = x & 0x7fff, xh = x >> 15;
  while (--n >= 0) {
    var l = this[i] & 0x7fff;
    var h = this[i++] >> 15;
    var m = xh * l + h * xl;
    l = xl * l + ((m & 0x7fff) << 15) + w[j] + (c & 0x3fffffff);
    c = (l >>> 30) + (m >>> 15) + xh * h + (c >>> 30);
    w[j++] = l & 0x3fffffff;
  }
  return c;
}
// Alternately, set max digit bits to 28 since some
// browsers slow down when dealing with 32-bit numbers.
function am3(i, x, w, j, c, n) {
  var xl = x & 0x3fff, xh = x >> 14;
  while (--n >= 0) {
    var l = this[i] & 0x3fff;
    var h = this[i++] >> 14;
    var m = xh * l + h * xl;
    l = xl * l + ((m & 0x3fff) << 14) + w[j] + c;
    c = (l >> 28) + (m >> 14) + xh * h;
    w[j++] = l & 0xfffffff;
  }
  return c;
}
 // Mozilla/Netscape seems to prefer am3
  BigInteger.prototype.am = am3;
  dbits = 28;


BigInteger.prototype.DB = dbits;
BigInteger.prototype.DM = ((1 << dbits) - 1);
BigInteger.prototype.DV = (1 << dbits);

var BI_FP = 52;
BigInteger.prototype.FV = Math.pow(2, BI_FP);
BigInteger.prototype.F1 = BI_FP - dbits;
BigInteger.prototype.F2 = 2 * dbits - BI_FP;

// Digit conversions
var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
var BI_RC = new Array();
var rr, vv;
rr = "0".charCodeAt(0);
for (vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
rr = "a".charCodeAt(0);
for (vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
rr = "A".charCodeAt(0);
for (vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;

function int2char(n) { return BI_RM.charAt(n); }
function intAt(s, i) {
  var c = BI_RC[s.charCodeAt(i)];
  return (c == null) ? -1 : c;
}

// (protected) copy this to r
function bnpCopyTo(r) {
  for (var i = this.t - 1; i >= 0; --i) r[i] = this[i];
  r.t = this.t;
  r.s = this.s;
}

// (protected) set from integer value x, -DV <= x < DV
function bnpFromInt(x) {
  this.t = 1;
  this.s = (x < 0) ? -1 : 0;
  if (x > 0) this[0] = x;
  else if (x < -1) this[0] = x + this.DV;
  else this.t = 0;
}

// return bigint initialized to value
function nbv(i) { var r = nbi(); r.fromInt(i); return r; }

// (protected) set from string and radix
function bnpFromString(s, b) {
  var k;
  if (b == 16) k = 4;
  else if (b == 8) k = 3;
  else if (b == 256) k = 8; // byte array
  else if (b == 2) k = 1;
  else if (b == 32) k = 5;
  else if (b == 4) k = 2;
  else { this.fromRadix(s, b); return; }
  this.t = 0;
  this.s = 0;
  var i = s.length, mi = false, sh = 0;
  while (--i >= 0) {
    var x = (k == 8) ? s[i] & 0xff : intAt(s, i);
    if (x < 0) {
      if (s.charAt(i) == "-") mi = true;
      continue;
    }
    mi = false;
    if (sh == 0)
      this[this.t++] = x;
    else if (sh + k > this.DB) {
      this[this.t - 1] |= (x & ((1 << (this.DB - sh)) - 1)) << sh;
      this[this.t++] = (x >> (this.DB - sh));
    }
    else
      this[this.t - 1] |= x << sh;
    sh += k;
    if (sh >= this.DB) sh -= this.DB;
  }
  if (k == 8 && (s[0] & 0x80) != 0) {
    this.s = -1;
    if (sh > 0) this[this.t - 1] |= ((1 << (this.DB - sh)) - 1) << sh;
  }
  this.clamp();
  if (mi) BigInteger.ZERO.subTo(this, this);
}

// (protected) clamp off excess high words
function bnpClamp() {
  var c = this.s & this.DM;
  while (this.t > 0 && this[this.t - 1] == c)--this.t;
}

// (public) return string representation in given radix
function bnToString(b) {
  if (this.s < 0) return "-" + this.negate().toString(b);
  var k;
  if (b == 16) k = 4;
  else if (b == 8) k = 3;
  else if (b == 2) k = 1;
  else if (b == 32) k = 5;
  else if (b == 4) k = 2;
  else return this.toRadix(b);
  var km = (1 << k) - 1, d, m = false, r = "", i = this.t;
  var p = this.DB - (i * this.DB) % k;
  if (i-- > 0) {
    if (p < this.DB && (d = this[i] >> p) > 0) { m = true; r = int2char(d); }
    while (i >= 0) {
      if (p < k) {
        d = (this[i] & ((1 << p) - 1)) << (k - p);
        d |= this[--i] >> (p += this.DB - k);
      }
      else {
        d = (this[i] >> (p -= k)) & km;
        if (p <= 0) { p += this.DB; --i; }
      }
      if (d > 0) m = true;
      if (m) r += int2char(d);
    }
  }
  return m ? r : "0";
}

// (public) -this
function bnNegate() { var r = nbi(); BigInteger.ZERO.subTo(this, r); return r; }

// (public) |this|
function bnAbs() { return (this.s < 0) ? this.negate() : this; }

// (public) return + if this > a, - if this < a, 0 if equal
function bnCompareTo(a) {
  var r = this.s - a.s;
  if (r != 0) return r;
  var i = this.t;
  r = i - a.t;
  if (r != 0) return (this.s < 0) ? -r : r;
  while (--i >= 0) if ((r = this[i] - a[i]) != 0) return r;
  return 0;
}

// returns bit length of the integer x
function nbits(x) {
  var r = 1, t;
  if ((t = x >>> 16) != 0) { x = t; r += 16; }
  if ((t = x >> 8) != 0) { x = t; r += 8; }
  if ((t = x >> 4) != 0) { x = t; r += 4; }
  if ((t = x >> 2) != 0) { x = t; r += 2; }
  if ((t = x >> 1) != 0) { x = t; r += 1; }
  return r;
}

// (public) return the number of bits in "this"
function bnBitLength() {
  if (this.t <= 0) return 0;
  return this.DB * (this.t - 1) + nbits(this[this.t - 1] ^ (this.s & this.DM));
}

// (protected) r = this << n*DB
function bnpDLShiftTo(n, r) {
  var i;
  for (i = this.t - 1; i >= 0; --i) r[i + n] = this[i];
  for (i = n - 1; i >= 0; --i) r[i] = 0;
  r.t = this.t + n;
  r.s = this.s;
}

// (protected) r = this >> n*DB
function bnpDRShiftTo(n, r) {
  for (var i = n; i < this.t; ++i) r[i - n] = this[i];
  r.t = Math.max(this.t - n, 0);
  r.s = this.s;
}

// (protected) r = this << n
function bnpLShiftTo(n, r) {
  var bs = n % this.DB;
  var cbs = this.DB - bs;
  var bm = (1 << cbs) - 1;
  var ds = Math.floor(n / this.DB), c = (this.s << bs) & this.DM, i;
  for (i = this.t - 1; i >= 0; --i) {
    r[i + ds + 1] = (this[i] >> cbs) | c;
    c = (this[i] & bm) << bs;
  }
  for (i = ds - 1; i >= 0; --i) r[i] = 0;
  r[ds] = c;
  r.t = this.t + ds + 1;
  r.s = this.s;
  r.clamp();
}

// (protected) r = this >> n
function bnpRShiftTo(n, r) {
  r.s = this.s;
  var ds = Math.floor(n / this.DB);
  if (ds >= this.t) { r.t = 0; return; }
  var bs = n % this.DB;
  var cbs = this.DB - bs;
  var bm = (1 << bs) - 1;
  r[0] = this[ds] >> bs;
  for (var i = ds + 1; i < this.t; ++i) {
    r[i - ds - 1] |= (this[i] & bm) << cbs;
    r[i - ds] = this[i] >> bs;
  }
  if (bs > 0) r[this.t - ds - 1] |= (this.s & bm) << cbs;
  r.t = this.t - ds;
  r.clamp();
}

// (protected) r = this - a
function bnpSubTo(a, r) {
  var i = 0, c = 0, m = Math.min(a.t, this.t);
  while (i < m) {
    c += this[i] - a[i];
    r[i++] = c & this.DM;
    c >>= this.DB;
  }
  if (a.t < this.t) {
    c -= a.s;
    while (i < this.t) {
      c += this[i];
      r[i++] = c & this.DM;
      c >>= this.DB;
    }
    c += this.s;
  }
  else {
    c += this.s;
    while (i < a.t) {
      c -= a[i];
      r[i++] = c & this.DM;
      c >>= this.DB;
    }
    c -= a.s;
  }
  r.s = (c < 0) ? -1 : 0;
  if (c < -1) r[i++] = this.DV + c;
  else if (c > 0) r[i++] = c;
  r.t = i;
  r.clamp();
}

// (protected) r = this * a, r != this,a (HAC 14.12)
// "this" should be the larger one if appropriate.
function bnpMultiplyTo(a, r) {
  var x = this.abs(), y = a.abs();
  var i = x.t;
  r.t = i + y.t;
  while (--i >= 0) r[i] = 0;
  for (i = 0; i < y.t; ++i) r[i + x.t] = x.am(0, y[i], r, i, 0, x.t);
  r.s = 0;
  r.clamp();
  if (this.s != a.s) BigInteger.ZERO.subTo(r, r);
}

// (protected) r = this^2, r != this (HAC 14.16)
function bnpSquareTo(r) {
  var x = this.abs();
  var i = r.t = 2 * x.t;
  while (--i >= 0) r[i] = 0;
  for (i = 0; i < x.t - 1; ++i) {
    var c = x.am(i, x[i], r, 2 * i, 0, 1);
    if ((r[i + x.t] += x.am(i + 1, 2 * x[i], r, 2 * i + 1, c, x.t - i - 1)) >= x.DV) {
      r[i + x.t] -= x.DV;
      r[i + x.t + 1] = 1;
    }
  }
  if (r.t > 0) r[r.t - 1] += x.am(i, x[i], r, 2 * i, 0, 1);
  r.s = 0;
  r.clamp();
}

// (protected) divide this by m, quotient and remainder to q, r (HAC 14.20)
// r != q, this != m.  q or r may be null.
function bnpDivRemTo(m, q, r) {
  var pm = m.abs();
  if (pm.t <= 0) return;
  var pt = this.abs();
  if (pt.t < pm.t) {
    if (q != null) q.fromInt(0);
    if (r != null) this.copyTo(r);
    return;
  }
  if (r == null) r = nbi();
  var y = nbi(), ts = this.s, ms = m.s;
  var nsh = this.DB - nbits(pm[pm.t - 1]);	// normalize modulus
  if (nsh > 0) { pm.lShiftTo(nsh, y); pt.lShiftTo(nsh, r); }
  else { pm.copyTo(y); pt.copyTo(r); }
  var ys = y.t;
  var y0 = y[ys - 1];
  if (y0 == 0) return;
  var yt = y0 * (1 << this.F1) + ((ys > 1) ? y[ys - 2] >> this.F2 : 0);
  var d1 = this.FV / yt, d2 = (1 << this.F1) / yt, e = 1 << this.F2;
  var i = r.t, j = i - ys, t = (q == null) ? nbi() : q;
  y.dlShiftTo(j, t);
  if (r.compareTo(t) >= 0) {
    r[r.t++] = 1;
    r.subTo(t, r);
  }
  BigInteger.ONE.dlShiftTo(ys, t);
  t.subTo(y, y);	// "negative" y so we can replace sub with am later
  while (y.t < ys) y[y.t++] = 0;
  while (--j >= 0) {
    // Estimate quotient digit
    var qd = (r[--i] == y0) ? this.DM : Math.floor(r[i] * d1 + (r[i - 1] + e) * d2);
    if ((r[i] += y.am(0, qd, r, j, 0, ys)) < qd) {	// Try it out
      y.dlShiftTo(j, t);
      r.subTo(t, r);
      while (r[i] < --qd) r.subTo(t, r);
    }
  }
  if (q != null) {
    r.drShiftTo(ys, q);
    if (ts != ms) BigInteger.ZERO.subTo(q, q);
  }
  r.t = ys;
  r.clamp();
  if (nsh > 0) r.rShiftTo(nsh, r);	// Denormalize remainder
  if (ts < 0) BigInteger.ZERO.subTo(r, r);
}

// (public) this mod a
function bnMod(a) {
  var r = nbi();
  this.abs().divRemTo(a, null, r);
  if (this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r, r);
  return r;
}

// Modular reduction using "classic" algorithm
function Classic(m) { this.m = m; }
function cConvert(x) {
  if (x.s < 0 || x.compareTo(this.m) >= 0) return x.mod(this.m);
  else return x;
}
function cRevert(x) { return x; }
function cReduce(x) { x.divRemTo(this.m, null, x); }
function cMulTo(x, y, r) { x.multiplyTo(y, r); this.reduce(r); }
function cSqrTo(x, r) { x.squareTo(r); this.reduce(r); }

Classic.prototype.convert = cConvert;
Classic.prototype.revert = cRevert;
Classic.prototype.reduce = cReduce;
Classic.prototype.mulTo = cMulTo;
Classic.prototype.sqrTo = cSqrTo;

// (protected) return "-1/this % 2^DB"; useful for Mont. reduction
// justification:
//         xy == 1 (mod m)
//         xy =  1+km
//   xy(2-xy) = (1+km)(1-km)
// x[y(2-xy)] = 1-k^2m^2
// x[y(2-xy)] == 1 (mod m^2)
// if y is 1/x mod m, then y(2-xy) is 1/x mod m^2
// should reduce x and y(2-xy) by m^2 at each step to keep size bounded.
// JS multiply "overflows" differently from C/C++, so care is needed here.
function bnpInvDigit() {
  if (this.t < 1) return 0;
  var x = this[0];
  if ((x & 1) == 0) return 0;
  var y = x & 3;		// y == 1/x mod 2^2
  y = (y * (2 - (x & 0xf) * y)) & 0xf;	// y == 1/x mod 2^4
  y = (y * (2 - (x & 0xff) * y)) & 0xff;	// y == 1/x mod 2^8
  y = (y * (2 - (((x & 0xffff) * y) & 0xffff))) & 0xffff;	// y == 1/x mod 2^16
  // last step - calculate inverse mod DV directly;
  // assumes 16 < DB <= 32 and assumes ability to handle 48-bit ints
  y = (y * (2 - x * y % this.DV)) % this.DV;		// y == 1/x mod 2^dbits
  // we really want the negative inverse, and -DV < y < DV
  return (y > 0) ? this.DV - y : -y;
}

// Montgomery reduction
function Montgomery(m) {
  this.m = m;
  this.mp = m.invDigit();
  this.mpl = this.mp & 0x7fff;
  this.mph = this.mp >> 15;
  this.um = (1 << (m.DB - 15)) - 1;
  this.mt2 = 2 * m.t;
}

// xR mod m
function montConvert(x) {
  var r = nbi();
  x.abs().dlShiftTo(this.m.t, r);
  r.divRemTo(this.m, null, r);
  if (x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r, r);
  return r;
}

// x/R mod m
function montRevert(x) {
  var r = nbi();
  x.copyTo(r);
  this.reduce(r);
  return r;
}

// x = x/R mod m (HAC 14.32)
function montReduce(x) {
  while (x.t <= this.mt2)	// pad x so am has enough room later
    x[x.t++] = 0;
  for (var i = 0; i < this.m.t; ++i) {
    // faster way of calculating u0 = x[i]*mp mod DV
    var j = x[i] & 0x7fff;
    var u0 = (j * this.mpl + (((j * this.mph + (x[i] >> 15) * this.mpl) & this.um) << 15)) & x.DM;
    // use am to combine the multiply-shift-add into one call
    j = i + this.m.t;
    x[j] += this.m.am(0, u0, x, i, 0, this.m.t);
    // propagate carry
    while (x[j] >= x.DV) { x[j] -= x.DV; x[++j]++; }
  }
  x.clamp();
  x.drShiftTo(this.m.t, x);
  if (x.compareTo(this.m) >= 0) x.subTo(this.m, x);
}

// r = "x^2/R mod m"; x != r
function montSqrTo(x, r) { x.squareTo(r); this.reduce(r); }

// r = "xy/R mod m"; x,y != r
function montMulTo(x, y, r) { x.multiplyTo(y, r); this.reduce(r); }

Montgomery.prototype.convert = montConvert;
Montgomery.prototype.revert = montRevert;
Montgomery.prototype.reduce = montReduce;
Montgomery.prototype.mulTo = montMulTo;
Montgomery.prototype.sqrTo = montSqrTo;

// (protected) true iff this is even
function bnpIsEven() { return ((this.t > 0) ? (this[0] & 1) : this.s) == 0; }

// (protected) this^e, e < 2^32, doing sqr and mul with "r" (HAC 14.79)
function bnpExp(e, z) {
  if (e > 0xffffffff || e < 1) return BigInteger.ONE;
  var r = nbi(), r2 = nbi(), g = z.convert(this), i = nbits(e) - 1;
  g.copyTo(r);
  while (--i >= 0) {
    z.sqrTo(r, r2);
    if ((e & (1 << i)) > 0) z.mulTo(r2, g, r);
    else { var t = r; r = r2; r2 = t; }
  }
  return z.revert(r);
}

// (public) this^e % m, 0 <= e < 2^32
function bnModPowInt(e, m) {
  var z;
  if (e < 256 || m.isEven()) z = new Classic(m); else z = new Montgomery(m);
  return this.exp(e, z);
}

// protected
BigInteger.prototype.copyTo = bnpCopyTo;
BigInteger.prototype.fromInt = bnpFromInt;
BigInteger.prototype.fromString = bnpFromString;
BigInteger.prototype.clamp = bnpClamp;
BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
BigInteger.prototype.drShiftTo = bnpDRShiftTo;
BigInteger.prototype.lShiftTo = bnpLShiftTo;
BigInteger.prototype.rShiftTo = bnpRShiftTo;
BigInteger.prototype.subTo = bnpSubTo;
BigInteger.prototype.multiplyTo = bnpMultiplyTo;
BigInteger.prototype.squareTo = bnpSquareTo;
BigInteger.prototype.divRemTo = bnpDivRemTo;
BigInteger.prototype.invDigit = bnpInvDigit;
BigInteger.prototype.isEven = bnpIsEven;
BigInteger.prototype.exp = bnpExp;

// public
BigInteger.prototype.toString = bnToString;
BigInteger.prototype.negate = bnNegate;
BigInteger.prototype.abs = bnAbs;
BigInteger.prototype.compareTo = bnCompareTo;
BigInteger.prototype.bitLength = bnBitLength;
BigInteger.prototype.mod = bnMod;
BigInteger.prototype.modPowInt = bnModPowInt;

// "constants"
BigInteger.ZERO = nbv(0);
BigInteger.ONE = nbv(1);

// Copyright (c) 2005-2009  Tom Wu
// All Rights Reserved.
// See "LICENSE" for details.

// Extended JavaScript BN functions, required for RSA private ops.

// Version 1.1: new BigInteger("0", 10) returns "proper" zero
// Version 1.2: square() API, isProbablePrime fix

// (public)
function bnClone() { var r = nbi(); this.copyTo(r); return r; }

// (public) return value as integer
function bnIntValue() {
  if (this.s < 0) {
    if (this.t == 1) return this[0] - this.DV;
    else if (this.t == 0) return -1;
  }
  else if (this.t == 1) return this[0];
  else if (this.t == 0) return 0;
  // assumes 16 < DB < 32
  return ((this[1] & ((1 << (32 - this.DB)) - 1)) << this.DB) | this[0];
}

// (public) return value as byte
function bnByteValue() { return (this.t == 0) ? this.s : (this[0] << 24) >> 24; }

// (public) return value as short (assumes DB>=16)
function bnShortValue() { return (this.t == 0) ? this.s : (this[0] << 16) >> 16; }

// (protected) return x s.t. r^x < DV
function bnpChunkSize(r) { return Math.floor(Math.LN2 * this.DB / Math.log(r)); }

// (public) 0 if this == 0, 1 if this > 0
function bnSigNum() {
  if (this.s < 0) return -1;
  else if (this.t <= 0 || (this.t == 1 && this[0] <= 0)) return 0;
  else return 1;
}

// (protected) convert to radix string
function bnpToRadix(b) {
  if (b == null) b = 10;
  if (this.signum() == 0 || b < 2 || b > 36) return "0";
  var cs = this.chunkSize(b);
  var a = Math.pow(b, cs);
  var d = nbv(a), y = nbi(), z = nbi(), r = "";
  this.divRemTo(d, y, z);
  while (y.signum() > 0) {
    r = (a + z.intValue()).toString(b).substr(1) + r;
    y.divRemTo(d, y, z);
  }
  return z.intValue().toString(b) + r;
}

// (protected) convert from radix string
function bnpFromRadix(s, b) {
  this.fromInt(0);
  if (b == null) b = 10;
  var cs = this.chunkSize(b);
  var d = Math.pow(b, cs), mi = false, j = 0, w = 0;
  for (var i = 0; i < s.length; ++i) {
    var x = intAt(s, i);
    if (x < 0) {
      if (s.charAt(i) == "-" && this.signum() == 0) mi = true;
      continue;
    }
    w = b * w + x;
    if (++j >= cs) {
      this.dMultiply(d);
      this.dAddOffset(w, 0);
      j = 0;
      w = 0;
    }
  }
  if (j > 0) {
    this.dMultiply(Math.pow(b, j));
    this.dAddOffset(w, 0);
  }
  if (mi) BigInteger.ZERO.subTo(this, this);
}

// (protected) alternate constructor
function bnpFromNumber(a, b, c) {
  if ("number" == typeof b) {
    // new BigInteger(int,int,RNG)
    if (a < 2) this.fromInt(1);
    else {
      this.fromNumber(a, c);
      if (!this.testBit(a - 1))	// force MSB set
        this.bitwiseTo(BigInteger.ONE.shiftLeft(a - 1), op_or, this);
      if (this.isEven()) this.dAddOffset(1, 0); // force odd
      while (!this.isProbablePrime(b)) {
        this.dAddOffset(2, 0);
        if (this.bitLength() > a) this.subTo(BigInteger.ONE.shiftLeft(a - 1), this);
      }
    }
  }
  else {
    // new BigInteger(int,RNG)
    var x = new Array(), t = a & 7;
    x.length = (a >> 3) + 1;
    b.nextBytes(x);
    if (t > 0) x[0] &= ((1 << t) - 1); else x[0] = 0;
    this.fromString(x, 256);
  }
}

// (public) convert to bigendian byte array
function bnToByteArray() {
  var i = this.t, r = new Array();
  r[0] = this.s;
  var p = this.DB - (i * this.DB) % 8, d, k = 0;
  if (i-- > 0) {
    if (p < this.DB && (d = this[i] >> p) != (this.s & this.DM) >> p)
      r[k++] = d | (this.s << (this.DB - p));
    while (i >= 0) {
      if (p < 8) {
        d = (this[i] & ((1 << p) - 1)) << (8 - p);
        d |= this[--i] >> (p += this.DB - 8);
      }
      else {
        d = (this[i] >> (p -= 8)) & 0xff;
        if (p <= 0) { p += this.DB; --i; }
      }
      if ((d & 0x80) != 0) d |= -256;
      if (k == 0 && (this.s & 0x80) != (d & 0x80))++k;
      if (k > 0 || d != this.s) r[k++] = d;
    }
  }
  return r;
}

function bnEquals(a) { return (this.compareTo(a) == 0); }
function bnMin(a) { return (this.compareTo(a) < 0) ? this : a; }
function bnMax(a) { return (this.compareTo(a) > 0) ? this : a; }

// (protected) r = this op a (bitwise)
function bnpBitwiseTo(a, op, r) {
  var i, f, m = Math.min(a.t, this.t);
  for (i = 0; i < m; ++i) r[i] = op(this[i], a[i]);
  if (a.t < this.t) {
    f = a.s & this.DM;
    for (i = m; i < this.t; ++i) r[i] = op(this[i], f);
    r.t = this.t;
  }
  else {
    f = this.s & this.DM;
    for (i = m; i < a.t; ++i) r[i] = op(f, a[i]);
    r.t = a.t;
  }
  r.s = op(this.s, a.s);
  r.clamp();
}

// (public) this & a
function op_and(x, y) { return x & y; }
function bnAnd(a) { var r = nbi(); this.bitwiseTo(a, op_and, r); return r; }

// (public) this | a
function op_or(x, y) { return x | y; }
function bnOr(a) { var r = nbi(); this.bitwiseTo(a, op_or, r); return r; }

// (public) this ^ a
function op_xor(x, y) { return x ^ y; }
function bnXor(a) { var r = nbi(); this.bitwiseTo(a, op_xor, r); return r; }

// (public) this & ~a
function op_andnot(x, y) { return x & ~y; }
function bnAndNot(a) { var r = nbi(); this.bitwiseTo(a, op_andnot, r); return r; }

// (public) ~this
function bnNot() {
  var r = nbi();
  for (var i = 0; i < this.t; ++i) r[i] = this.DM & ~this[i];
  r.t = this.t;
  r.s = ~this.s;
  return r;
}

// (public) this << n
function bnShiftLeft(n) {
  var r = nbi();
  if (n < 0) this.rShiftTo(-n, r); else this.lShiftTo(n, r);
  return r;
}

// (public) this >> n
function bnShiftRight(n) {
  var r = nbi();
  if (n < 0) this.lShiftTo(-n, r); else this.rShiftTo(n, r);
  return r;
}

// return index of lowest 1-bit in x, x < 2^31
function lbit(x) {
  if (x == 0) return -1;
  var r = 0;
  if ((x & 0xffff) == 0) { x >>= 16; r += 16; }
  if ((x & 0xff) == 0) { x >>= 8; r += 8; }
  if ((x & 0xf) == 0) { x >>= 4; r += 4; }
  if ((x & 3) == 0) { x >>= 2; r += 2; }
  if ((x & 1) == 0)++r;
  return r;
}

// (public) returns index of lowest 1-bit (or -1 if none)
function bnGetLowestSetBit() {
  for (var i = 0; i < this.t; ++i)
    if (this[i] != 0) return i * this.DB + lbit(this[i]);
  if (this.s < 0) return this.t * this.DB;
  return -1;
}

// return number of 1 bits in x
function cbit(x) {
  var r = 0;
  while (x != 0) { x &= x - 1; ++r; }
  return r;
}

// (public) return number of set bits
function bnBitCount() {
  var r = 0, x = this.s & this.DM;
  for (var i = 0; i < this.t; ++i) r += cbit(this[i] ^ x);
  return r;
}

// (public) true iff nth bit is set
function bnTestBit(n) {
  var j = Math.floor(n / this.DB);
  if (j >= this.t) return (this.s != 0);
  return ((this[j] & (1 << (n % this.DB))) != 0);
}

// (protected) this op (1<<n)
function bnpChangeBit(n, op) {
  var r = BigInteger.ONE.shiftLeft(n);
  this.bitwiseTo(r, op, r);
  return r;
}

// (public) this | (1<<n)
function bnSetBit(n) { return this.changeBit(n, op_or); }

// (public) this & ~(1<<n)
function bnClearBit(n) { return this.changeBit(n, op_andnot); }

// (public) this ^ (1<<n)
function bnFlipBit(n) { return this.changeBit(n, op_xor); }

// (protected) r = this + a
function bnpAddTo(a, r) {
  var i = 0, c = 0, m = Math.min(a.t, this.t);
  while (i < m) {
    c += this[i] + a[i];
    r[i++] = c & this.DM;
    c >>= this.DB;
  }
  if (a.t < this.t) {
    c += a.s;
    while (i < this.t) {
      c += this[i];
      r[i++] = c & this.DM;
      c >>= this.DB;
    }
    c += this.s;
  }
  else {
    c += this.s;
    while (i < a.t) {
      c += a[i];
      r[i++] = c & this.DM;
      c >>= this.DB;
    }
    c += a.s;
  }
  r.s = (c < 0) ? -1 : 0;
  if (c > 0) r[i++] = c;
  else if (c < -1) r[i++] = this.DV + c;
  r.t = i;
  r.clamp();
}

// (public) this + a
function bnAdd(a) { var r = nbi(); this.addTo(a, r); return r; }

// (public) this - a
function bnSubtract(a) { var r = nbi(); this.subTo(a, r); return r; }

// (public) this * a
function bnMultiply(a) { var r = nbi(); this.multiplyTo(a, r); return r; }

// (public) this^2
function bnSquare() { var r = nbi(); this.squareTo(r); return r; }

// (public) this / a
function bnDivide(a) { var r = nbi(); this.divRemTo(a, r, null); return r; }

// (public) this % a
function bnRemainder(a) { var r = nbi(); this.divRemTo(a, null, r); return r; }

// (public) [this/a,this%a]
function bnDivideAndRemainder(a) {
  var q = nbi(), r = nbi();
  this.divRemTo(a, q, r);
  return new Array(q, r);
}

// (protected) this *= n, this >= 0, 1 < n < DV
function bnpDMultiply(n) {
  this[this.t] = this.am(0, n - 1, this, 0, 0, this.t);
  ++this.t;
  this.clamp();
}

// (protected) this += n << w words, this >= 0
function bnpDAddOffset(n, w) {
  if (n == 0) return;
  while (this.t <= w) this[this.t++] = 0;
  this[w] += n;
  while (this[w] >= this.DV) {
    this[w] -= this.DV;
    if (++w >= this.t) this[this.t++] = 0;
    ++this[w];
  }
}

// A "null" reducer
function NullExp() { }
function nNop(x) { return x; }
function nMulTo(x, y, r) { x.multiplyTo(y, r); }
function nSqrTo(x, r) { x.squareTo(r); }

NullExp.prototype.convert = nNop;
NullExp.prototype.revert = nNop;
NullExp.prototype.mulTo = nMulTo;
NullExp.prototype.sqrTo = nSqrTo;

// (public) this^e
function bnPow(e) { return this.exp(e, new NullExp()); }

// (protected) r = lower n words of "this * a", a.t <= n
// "this" should be the larger one if appropriate.
function bnpMultiplyLowerTo(a, n, r) {
  var i = Math.min(this.t + a.t, n);
  r.s = 0; // assumes a,this >= 0
  r.t = i;
  while (i > 0) r[--i] = 0;
  var j;
  for (j = r.t - this.t; i < j; ++i) r[i + this.t] = this.am(0, a[i], r, i, 0, this.t);
  for (j = Math.min(a.t, n); i < j; ++i) this.am(0, a[i], r, i, 0, n - i);
  r.clamp();
}

// (protected) r = "this * a" without lower n words, n > 0
// "this" should be the larger one if appropriate.
function bnpMultiplyUpperTo(a, n, r) {
  --n;
  var i = r.t = this.t + a.t - n;
  r.s = 0; // assumes a,this >= 0
  while (--i >= 0) r[i] = 0;
  for (i = Math.max(n - this.t, 0); i < a.t; ++i)
    r[this.t + i - n] = this.am(n - i, a[i], r, 0, 0, this.t + i - n);
  r.clamp();
  r.drShiftTo(1, r);
}

// Barrett modular reduction
function Barrett(m) {
  // setup Barrett
  this.r2 = nbi();
  this.q3 = nbi();
  BigInteger.ONE.dlShiftTo(2 * m.t, this.r2);
  this.mu = this.r2.divide(m);
  this.m = m;
}

function barrettConvert(x) {
  if (x.s < 0 || x.t > 2 * this.m.t) return x.mod(this.m);
  else if (x.compareTo(this.m) < 0) return x;
  else { var r = nbi(); x.copyTo(r); this.reduce(r); return r; }
}

function barrettRevert(x) { return x; }

// x = x mod m (HAC 14.42)
function barrettReduce(x) {
  x.drShiftTo(this.m.t - 1, this.r2);
  if (x.t > this.m.t + 1) { x.t = this.m.t + 1; x.clamp(); }
  this.mu.multiplyUpperTo(this.r2, this.m.t + 1, this.q3);
  this.m.multiplyLowerTo(this.q3, this.m.t + 1, this.r2);
  while (x.compareTo(this.r2) < 0) x.dAddOffset(1, this.m.t + 1);
  x.subTo(this.r2, x);
  while (x.compareTo(this.m) >= 0) x.subTo(this.m, x);
}

// r = x^2 mod m; x != r
function barrettSqrTo(x, r) { x.squareTo(r); this.reduce(r); }

// r = x*y mod m; x,y != r
function barrettMulTo(x, y, r) { x.multiplyTo(y, r); this.reduce(r); }

Barrett.prototype.convert = barrettConvert;
Barrett.prototype.revert = barrettRevert;
Barrett.prototype.reduce = barrettReduce;
Barrett.prototype.mulTo = barrettMulTo;
Barrett.prototype.sqrTo = barrettSqrTo;

// (public) this^e % m (HAC 14.85)
function bnModPow(e, m) {
  var i = e.bitLength(), k, r = nbv(1), z;
  if (i <= 0) return r;
  else if (i < 18) k = 1;
  else if (i < 48) k = 3;
  else if (i < 144) k = 4;
  else if (i < 768) k = 5;
  else k = 6;
  if (i < 8)
    z = new Classic(m);
  else if (m.isEven())
    z = new Barrett(m);
  else
    z = new Montgomery(m);

  // precomputation
  var g = new Array(), n = 3, k1 = k - 1, km = (1 << k) - 1;
  g[1] = z.convert(this);
  if (k > 1) {
    var g2 = nbi();
    z.sqrTo(g[1], g2);
    while (n <= km) {
      g[n] = nbi();
      z.mulTo(g2, g[n - 2], g[n]);
      n += 2;
    }
  }

  var j = e.t - 1, w, is1 = true, r2 = nbi(), t;
  i = nbits(e[j]) - 1;
  while (j >= 0) {
    if (i >= k1) w = (e[j] >> (i - k1)) & km;
    else {
      w = (e[j] & ((1 << (i + 1)) - 1)) << (k1 - i);
      if (j > 0) w |= e[j - 1] >> (this.DB + i - k1);
    }

    n = k;
    while ((w & 1) == 0) { w >>= 1; --n; }
    if ((i -= n) < 0) { i += this.DB; --j; }
    if (is1) {	// ret == 1, don't bother squaring or multiplying it
      g[w].copyTo(r);
      is1 = false;
    }
    else {
      while (n > 1) { z.sqrTo(r, r2); z.sqrTo(r2, r); n -= 2; }
      if (n > 0) z.sqrTo(r, r2); else { t = r; r = r2; r2 = t; }
      z.mulTo(r2, g[w], r);
    }

    while (j >= 0 && (e[j] & (1 << i)) == 0) {
      z.sqrTo(r, r2); t = r; r = r2; r2 = t;
      if (--i < 0) { i = this.DB - 1; --j; }
    }
  }
  return z.revert(r);
}

// (public) gcd(this,a) (HAC 14.54)
function bnGCD(a) {
  var x = (this.s < 0) ? this.negate() : this.clone();
  var y = (a.s < 0) ? a.negate() : a.clone();
  if (x.compareTo(y) < 0) { var t = x; x = y; y = t; }
  var i = x.getLowestSetBit(), g = y.getLowestSetBit();
  if (g < 0) return x;
  if (i < g) g = i;
  if (g > 0) {
    x.rShiftTo(g, x);
    y.rShiftTo(g, y);
  }
  while (x.signum() > 0) {
    if ((i = x.getLowestSetBit()) > 0) x.rShiftTo(i, x);
    if ((i = y.getLowestSetBit()) > 0) y.rShiftTo(i, y);
    if (x.compareTo(y) >= 0) {
      x.subTo(y, x);
      x.rShiftTo(1, x);
    }
    else {
      y.subTo(x, y);
      y.rShiftTo(1, y);
    }
  }
  if (g > 0) y.lShiftTo(g, y);
  return y;
}

// (protected) this % n, n < 2^26
function bnpModInt(n) {
  if (n <= 0) return 0;
  var d = this.DV % n, r = (this.s < 0) ? n - 1 : 0;
  if (this.t > 0)
    if (d == 0) r = this[0] % n;
    else for (var i = this.t - 1; i >= 0; --i) r = (d * r + this[i]) % n;
  return r;
}

// (public) 1/this % m (HAC 14.61)
function bnModInverse(m) {
  var ac = m.isEven();
  if ((this.isEven() && ac) || m.signum() == 0) return BigInteger.ZERO;
  var u = m.clone(), v = this.clone();
  var a = nbv(1), b = nbv(0), c = nbv(0), d = nbv(1);
  while (u.signum() != 0) {
    while (u.isEven()) {
      u.rShiftTo(1, u);
      if (ac) {
        if (!a.isEven() || !b.isEven()) { a.addTo(this, a); b.subTo(m, b); }
        a.rShiftTo(1, a);
      }
      else if (!b.isEven()) b.subTo(m, b);
      b.rShiftTo(1, b);
    }
    while (v.isEven()) {
      v.rShiftTo(1, v);
      if (ac) {
        if (!c.isEven() || !d.isEven()) { c.addTo(this, c); d.subTo(m, d); }
        c.rShiftTo(1, c);
      }
      else if (!d.isEven()) d.subTo(m, d);
      d.rShiftTo(1, d);
    }
    if (u.compareTo(v) >= 0) {
      u.subTo(v, u);
      if (ac) a.subTo(c, a);
      b.subTo(d, b);
    }
    else {
      v.subTo(u, v);
      if (ac) c.subTo(a, c);
      d.subTo(b, d);
    }
  }
  if (v.compareTo(BigInteger.ONE) != 0) return BigInteger.ZERO;
  if (d.compareTo(m) >= 0) return d.subtract(m);
  if (d.signum() < 0) d.addTo(m, d); else return d;
  if (d.signum() < 0) return d.add(m); else return d;
}

var lowprimes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691, 701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797, 809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 997];
var lplim = (1 << 26) / lowprimes[lowprimes.length - 1];

// (public) test primality with certainty >= 1-.5^t
function bnIsProbablePrime(t) {
  var i, x = this.abs();
  if (x.t == 1 && x[0] <= lowprimes[lowprimes.length - 1]) {
    for (i = 0; i < lowprimes.length; ++i)
      if (x[0] == lowprimes[i]) return true;
    return false;
  }
  if (x.isEven()) return false;
  i = 1;
  while (i < lowprimes.length) {
    var m = lowprimes[i], j = i + 1;
    while (j < lowprimes.length && m < lplim) m *= lowprimes[j++];
    m = x.modInt(m);
    while (i < j) if (m % lowprimes[i++] == 0) return false;
  }
  return x.millerRabin(t);
}

// (protected) true if probably prime (HAC 4.24, Miller-Rabin)
function bnpMillerRabin(t) {
  var n1 = this.subtract(BigInteger.ONE);
  var k = n1.getLowestSetBit();
  if (k <= 0) return false;
  var r = n1.shiftRight(k);
  t = (t + 1) >> 1;
  if (t > lowprimes.length) t = lowprimes.length;
  var a = nbi();
  for (var i = 0; i < t; ++i) {
    //Pick bases at random, instead of starting at 2
    a.fromInt(lowprimes[Math.floor(Math.random() * lowprimes.length)]);
    var y = a.modPow(r, this);
    if (y.compareTo(BigInteger.ONE) != 0 && y.compareTo(n1) != 0) {
      var j = 1;
      while (j++ < k && y.compareTo(n1) != 0) {
        y = y.modPowInt(2, this);
        if (y.compareTo(BigInteger.ONE) == 0) return false;
      }
      if (y.compareTo(n1) != 0) return false;
    }
  }
  return true;
}

// protected
BigInteger.prototype.chunkSize = bnpChunkSize;
BigInteger.prototype.toRadix = bnpToRadix;
BigInteger.prototype.fromRadix = bnpFromRadix;
BigInteger.prototype.fromNumber = bnpFromNumber;
BigInteger.prototype.bitwiseTo = bnpBitwiseTo;
BigInteger.prototype.changeBit = bnpChangeBit;
BigInteger.prototype.addTo = bnpAddTo;
BigInteger.prototype.dMultiply = bnpDMultiply;
BigInteger.prototype.dAddOffset = bnpDAddOffset;
BigInteger.prototype.multiplyLowerTo = bnpMultiplyLowerTo;
BigInteger.prototype.multiplyUpperTo = bnpMultiplyUpperTo;
BigInteger.prototype.modInt = bnpModInt;
BigInteger.prototype.millerRabin = bnpMillerRabin;

// public
BigInteger.prototype.clone = bnClone;
BigInteger.prototype.intValue = bnIntValue;
BigInteger.prototype.byteValue = bnByteValue;
BigInteger.prototype.shortValue = bnShortValue;
BigInteger.prototype.signum = bnSigNum;
BigInteger.prototype.toByteArray = bnToByteArray;
BigInteger.prototype.equals = bnEquals;
BigInteger.prototype.min = bnMin;
BigInteger.prototype.max = bnMax;
BigInteger.prototype.and = bnAnd;
BigInteger.prototype.or = bnOr;
BigInteger.prototype.xor = bnXor;
BigInteger.prototype.andNot = bnAndNot;
BigInteger.prototype.not = bnNot;
BigInteger.prototype.shiftLeft = bnShiftLeft;
BigInteger.prototype.shiftRight = bnShiftRight;
BigInteger.prototype.getLowestSetBit = bnGetLowestSetBit;
BigInteger.prototype.bitCount = bnBitCount;
BigInteger.prototype.testBit = bnTestBit;
BigInteger.prototype.setBit = bnSetBit;
BigInteger.prototype.clearBit = bnClearBit;
BigInteger.prototype.flipBit = bnFlipBit;
BigInteger.prototype.add = bnAdd;
BigInteger.prototype.subtract = bnSubtract;
BigInteger.prototype.multiply = bnMultiply;
BigInteger.prototype.divide = bnDivide;
BigInteger.prototype.remainder = bnRemainder;
BigInteger.prototype.divideAndRemainder = bnDivideAndRemainder;
BigInteger.prototype.modPow = bnModPow;
BigInteger.prototype.modInverse = bnModInverse;
BigInteger.prototype.pow = bnPow;
BigInteger.prototype.gcd = bnGCD;
BigInteger.prototype.isProbablePrime = bnIsProbablePrime;

// JSBN-specific extension
BigInteger.prototype.square = bnSquare;

// BigInteger interfaces not implemented in jsbn:

// BigInteger(int signum, byte[] magnitude)
// double doubleValue()
// float floatValue()
// int hashCode()
// long longValue()
// static BigInteger valueOf(long val)


/*jsbn end*/

/*address start */
function GGVAddress() {
  var codeword = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var syndrome = [0, 0, 0, 0, 0];

  var gexp = [1, 2, 4, 8, 16, 5, 10, 20, 13, 26, 17, 7, 14, 28, 29, 31, 27, 19, 3, 6, 12, 24, 21, 15, 30, 25, 23, 11, 22, 9, 18, 1];
  var glog = [0, 0, 1, 18, 2, 5, 19, 11, 3, 29, 6, 27, 20, 8, 12, 23, 4, 10, 30, 17, 7, 22, 28, 26, 21, 25, 9, 16, 13, 14, 24, 15];

  var cwmap = [3, 2, 1, 0, 7, 6, 5, 4, 13, 14, 15, 16, 12, 8, 9, 10, 11];

  var alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  //var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ345679';

  this.guess = [];

  function ginv(a) {
    return gexp[31 - glog[a]];
  }

  function gmult(a, b) {
    if (a == 0 || b == 0) return 0;

    var idx = (glog[a] + glog[b]) % 31;

    return gexp[idx];
  } //__________________________

  function calc_discrepancy(lambda, r) {
    var discr = 0;

    for (var i = 0; i < r; i++) {
      discr ^= gmult(lambda[i], syndrome[r - i]);
    }

    return discr;
  } //__________________________

  function find_errors(lambda) {
    var errloc = [];

    for (var i = 1; i <= 31; i++) {
      var sum = 0;

      for (var j = 0; j < 5; j++) {
        sum ^= gmult(gexp[(j * i) % 31], lambda[j]);
      }

      if (sum == 0) {
        var pos = 31 - i;
        if (pos > 12 && pos < 27) return [];

        errloc[errloc.length] = pos;
      }
    }

    return errloc;
  } //__________________________

  function guess_errors() {
    var el = 0,
      b = [0, 0, 0, 0, 0],
      t = [];

    var deg_lambda = 0,
      lambda = [1, 0, 0, 0, 0]; // error+erasure locator poly

    // Berlekamp-Massey algorithm to determine error+erasure locator polynomial

    for (var r = 0; r < 4; r++) {
      var discr = calc_discrepancy(lambda, r + 1); // Compute discrepancy at the r-th step in poly-form

      if (discr != 0) {
        deg_lambda = 0;

        for (var i = 0; i < 5; i++) {
          t[i] = lambda[i] ^ gmult(discr, b[i]);

          if (t[i]) deg_lambda = i;
        }

        if (2 * el <= r) {
          el = r + 1 - el;

          for (i = 0; i < 5; i++) {
            b[i] = gmult(lambda[i], ginv(discr));
          }
        }

        lambda = t.slice(); // copy
      }

      b.unshift(0); // shift => mul by x
    }

    // Find roots of the locator polynomial.

    var errloc = find_errors(lambda);

    var errors = errloc.length;

    if (errors < 1 || errors > 2) return false;

    if (deg_lambda != errors) return false; // deg(lambda) unequal to number of roots => uncorrectable error

    // Compute err+eras evaluator poly omega(x) = s(x)*lambda(x) (modulo x**(4)). Also find deg(omega).

    var omega = [0, 0, 0, 0, 0];

    for (var i = 0; i < 4; i++) {
      var t = 0;

      for (var j = 0; j < i; j++) {
        t ^= gmult(syndrome[i + 1 - j], lambda[j]);
      }

      omega[i] = t;
    }

    // Compute error values in poly-form.

    for (r = 0; r < errors; r++) {
      var t = 0;
      var pos = errloc[r];
      var root = 31 - pos;

      for (i = 0; i < 4; i++) // evaluate Omega at alpha^(-i)
      {
        t ^= gmult(omega[i], gexp[(root * i) % 31]);
      }

      if (t) // evaluate Lambda' (derivative) at alpha^(-i); all odd powers disappear
      {
        var denom = gmult(lambda[1], 1) ^ gmult(lambda[3], gexp[(root * 2) % 31]);

        if (denom == 0) return false;

        if (pos > 12) pos -= 14;

        codeword[pos] ^= gmult(t, ginv(denom));
      }
    }

    return true;
  } //__________________________

  function encode() {
    var p = [0, 0, 0, 0];

    for (var i = 12; i >= 0; i--) {
      var fb = codeword[i] ^ p[3];

      p[3] = p[2] ^ gmult(30, fb);
      p[2] = p[1] ^ gmult(6, fb);
      p[1] = p[0] ^ gmult(9, fb);
      p[0] = gmult(17, fb);
    }

    codeword[13] = p[0];
    codeword[14] = p[1];
    codeword[15] = p[2];
    codeword[16] = p[3];
  } //__________________________

  function reset() {
    for (var i = 0; i < 17; i++) codeword[i] = 1;
  } //__________________________

  function set_codeword(cw, len, skip) {
    if (typeof len === 'undefined') len = 17;
    if (typeof skip === 'undefined') skip = -1;

    for (var i = 0, j = 0; i < len; i++) {
      if (i != skip) codeword[cwmap[j++]] = cw[i];
    }
  } //__________________________

  this.add_guess = function () {
    var s = this.toString(),
      len = this.guess.length;

    if (len > 2) return;

    for (var i = 0; i < len; i++) {
      if (this.guess[i] == s) return;
    }

    this.guess[len] = s;
  } //__________________________

  this.ok = function () {
    var sum = 0;

    for (var i = 1; i < 5; i++) {
      for (var j = 0, t = 0; j < 31; j++) {
        if (j > 12 && j < 27) continue;

        var pos = j;
        if (j > 26) pos -= 14;

        t ^= gmult(codeword[pos], gexp[(i * j) % 31]);
      }

      sum |= t;
      syndrome[i] = t;
    }

    return (sum == 0);
  } //__________________________

  function from_acc(acc) {
    var inp = [],
      out = [],
      pos = 0,
      len = acc.length;

    if (len == 20 && acc.charAt(0) != '1') return false;

    for (var i = 0; i < len; i++) {
      inp[i] = acc.charCodeAt(i) - '0'.charCodeAt(0);
    }

    do // base 10 to base 32 conversion
    {
      var divide = 0,
        newlen = 0;

      for (i = 0; i < len; i++) {
        divide = divide * 10 + inp[i];

        if (divide >= 32) {
          inp[newlen++] = divide >> 5;
          divide &= 31;
        } else if (newlen > 0) {
          inp[newlen++] = 0;
        }
      }

      len = newlen;
      out[pos++] = divide;
    }
    while (newlen);

    for (i = 0; i < 13; i++) // copy to codeword in reverse, pad with 0's
    {
      codeword[i] = (--pos >= 0 ? out[i] : 0);
    }

    encode();

    return true;
  } //__________________________

  this.toString = function () {
    var out = 'BT-';

    for (var i = 0; i < 17; i++) {
      out += alphabet[codeword[cwmap[i]]];

      if ((i & 3) == 3 && i < 13) out += '-';
    }

    return out;
  } //__________________________

  this.account_id = function () {
    var out = '',
      inp = [],
      len = 13;

    for (var i = 0; i < 13; i++) {
      inp[i] = codeword[12 - i];
    }

    do // base 32 to base 10 conversion
    {
      var divide = 0,
        newlen = 0;

      for (i = 0; i < len; i++) {
        divide = divide * 32 + inp[i];

        if (divide >= 10) {
          inp[newlen++] = Math.floor(divide / 10);
          divide %= 10;
        } else if (newlen > 0) {
          inp[newlen++] = 0;
        }
      }

      len = newlen;
      out += String.fromCharCode(divide + '0'.charCodeAt(0));
    }
    while (newlen);

    return out.split("").reverse().join("");
  } //__________________________

  this.set = function (adr, allow_accounts) {
    if (typeof allow_accounts === 'undefined') allow_accounts = true;

    var len = 0;
    this.guess = [];
    reset();

    adr = String(adr);

    adr = adr.replace(/(^\s+)|(\s+$)/g, '').toUpperCase();

    if (adr.indexOf('BT-') == 0) adr = adr.substr(4);

    if (adr.match(/^\d{1,20}$/g)) // account id
    {
      if (allow_accounts) return from_acc(adr);
    } else // address
    {
      var clean = [];

      for (var i = 0; i < adr.length; i++) {
        var pos = alphabet.indexOf(adr[i]);

        if (pos >= 0) {
          clean[len++] = pos;
          if (len > 18) return false;
        }
      }
    }

    if (len == 16) // guess deletion
    {
      for (var i = 16; i >= 0; i--) {
        for (var j = 0; j < 32; j++) {
          clean[i] = j;

          set_codeword(clean);

          if (this.ok()) this.add_guess();
        }

        if (i > 0) {
          var t = clean[i - 1];
          clean[i - 1] = clean[i];
          clean[i] = t;
        }
      }
    }

    if (len == 18) // guess insertion
    {
      for (var i = 0; i < 18; i++) {
        set_codeword(clean, 18, i);

        if (this.ok()) this.add_guess();
      }
    }

    if (len == 17) {
      set_codeword(clean);

      if (this.ok()) return true;

      if (guess_errors() && this.ok()) this.add_guess();
    }

    reset();

    return false;
  }

  this.format_guess = function (s, org) {
    var d = '',
      list = [];

    s = s.toUpperCase();
    org = org.toUpperCase();

    for (var i = 0; i < s.length;) {
      var m = 0;

      for (var j = 1; j < s.length; j++) {
        var pos = org.indexOf(s.substr(i, j));

        if (pos != -1) {
          if (Math.abs(pos - i) < 3) m = j;
        } else break;
      }

      if (m) {
        list[list.length] = {
          's': i,
          'e': i + m
        };
        i += m;
      } else i++;
    }

    if (list.length == 0) return s;

    for (var i = 0, j = 0; i < s.length; i++) {
      if (i >= list[j].e) {
        var start;

        while (j < list.length - 1) {
          start = list[j++].s;

          if (i < list[j].e || list[j].s >= start) break;
        }
      }

      if (i >= list[j].s && i < list[j].e) {
        d += s.charAt(i);
      } else {
        d += '<b style="color:red">' + s.charAt(i) + '</b>';
      }
    }

    return d;
  }
}


/*convert start*/

var converters = function () {
  var charToNibble = {};
  var nibbleToChar = [];
  var i;
  for (i = 0; i <= 9; ++i) {
    var character = i.toString();
    charToNibble[character] = i;
    nibbleToChar.push(character);
  }

  for (i = 10; i <= 15; ++i) {
    var lowerChar = String.fromCharCode('a'.charCodeAt(0) + i - 10);
    var upperChar = String.fromCharCode('A'.charCodeAt(0) + i - 10);

    charToNibble[lowerChar] = i;
    charToNibble[upperChar] = i;
    nibbleToChar.push(lowerChar);
  }

  return {
    byteArrayToHexString: function (bytes) {
      var str = '';
      for (var i = 0; i < bytes.length; ++i) {
        if (bytes[i] < 0) {
          bytes[i] += 256;
        }
        str += nibbleToChar[bytes[i] >> 4] + nibbleToChar[bytes[i] & 0x0F];
      }

      return str;
    },
    stringToByteArray: function (str) {
      str = unescape(encodeURIComponent(str)); //temporary

      var bytes = new Array(str.length);
      for (var i = 0; i < str.length; ++i)
        bytes[i] = str.charCodeAt(i);

      return bytes;
    },
    hexStringToByteArray: function (str) {
      var bytes = [];
      var i = 0;
      if (0 !== str.length % 2) {
        bytes.push(charToNibble[str.charAt(0)]);
        ++i;
      }

      for (; i < str.length - 1; i += 2)
        bytes.push((charToNibble[str.charAt(i)] << 4) + charToNibble[str.charAt(i + 1)]);

      return bytes;
    },
    stringToHexString: function (str) {
      return this.byteArrayToHexString(this.stringToByteArray(str));
    },
    hexStringToString: function (hex) {
      return this.byteArrayToString(this.hexStringToByteArray(hex));
    },
    checkBytesToIntInput: function (bytes, numBytes, opt_startIndex) {
      var startIndex = opt_startIndex || 0;
      if (startIndex < 0) {
        throw new Error('Start index should not be negative');
      }

      if (bytes.length < startIndex + numBytes) {
        throw new Error('Need at least ' + (numBytes) + ' bytes to convert to an integer');
      }
      return startIndex;
    },
    byteArrayToSignedShort: function (bytes, opt_startIndex) {
      var index = this.checkBytesToIntInput(bytes, 2, opt_startIndex);
      var value = bytes[index];
      value += bytes[index + 1] << 8;
      return value;
    },
    byteArrayToSignedInt32: function (bytes, opt_startIndex) {
      var index = this.checkBytesToIntInput(bytes, 4, opt_startIndex);
      var value = bytes[index];
      value += bytes[index + 1] << 8;
      value += bytes[index + 2] << 16;
      value += bytes[index + 3] << 24;
      return value;
    },
    byteArrayToBigInteger: function (bytes, opt_startIndex) {
      var index = this.checkBytesToIntInput(bytes, 8, opt_startIndex);

      var value = new BigInteger("0", 10);

      var temp1, temp2;

      for (var i = 7; i >= 0; i--) {
        temp1 = value.multiply(new BigInteger("256", 10));
        temp2 = temp1.add(new BigInteger(bytes[opt_startIndex + i].toString(10), 10));
        value = temp2;
      }

      return value;
    },
    // create a wordArray that is Big-Endian
    byteArrayToWordArray: function (byteArray) {
      var i = 0,
        offset = 0,
        word = 0,
        len = byteArray.length;
      var words = new Uint32Array(((len / 4) | 0) + (len % 4 == 0 ? 0 : 1));

      while (i < (len - (len % 4))) {
        words[offset++] = (byteArray[i++] << 24) | (byteArray[i++] << 16) | (byteArray[i++] << 8) | (byteArray[i++]);
      }
      if (len % 4 != 0) {
        word = byteArray[i++] << 24;
        if (len % 4 > 1) {
          word = word | byteArray[i++] << 16;
        }
        if (len % 4 > 2) {
          word = word | byteArray[i++] << 8;
        }
        words[offset] = word;
      }
      var wordArray = new Object();
      wordArray.sigBytes = len;
      wordArray.words = words;

      return wordArray;
    },
    // assumes wordArray is Big-Endian
    wordArrayToByteArray: function (wordArray) {
      return converters.wordArrayToByteArrayImpl(wordArray, true);
    },
    wordArrayToByteArrayImpl: function (wordArray, isFirstByteHasSign) {
      var len = wordArray.words.length;
      if (len == 0) {
        return new Array(0);
      }
      var byteArray = new Array(wordArray.sigBytes);
      var offset = 0,
        word, i;
      for (i = 0; i < len - 1; i++) {
        word = wordArray.words[i];
        byteArray[offset++] = isFirstByteHasSign ? word >> 24 : (word >> 24) & 0xff;
        byteArray[offset++] = (word >> 16) & 0xff;
        byteArray[offset++] = (word >> 8) & 0xff;
        byteArray[offset++] = word & 0xff;
      }
      word = wordArray.words[len - 1];
      byteArray[offset++] = isFirstByteHasSign ? word >> 24 : (word >> 24) & 0xff;
      if (wordArray.sigBytes % 4 == 0) {
        byteArray[offset++] = (word >> 16) & 0xff;
        byteArray[offset++] = (word >> 8) & 0xff;
        byteArray[offset++] = word & 0xff;
      }
      if (wordArray.sigBytes % 4 > 1) {
        byteArray[offset++] = (word >> 16) & 0xff;
      }
      if (wordArray.sigBytes % 4 > 2) {
        byteArray[offset++] = (word >> 8) & 0xff;
      }
      return byteArray;
    },
    byteArrayToString: function (bytes, opt_startIndex, length) {
      if (length == 0) {
        return "";
      }

      if (opt_startIndex && length) {
        var index = this.checkBytesToIntInput(bytes, parseInt(length, 10), parseInt(opt_startIndex, 10));

        bytes = bytes.slice(opt_startIndex, opt_startIndex + length);
      }

      return decodeURIComponent(escape(String.fromCharCode.apply(null, bytes)));
    },
    byteArrayToShortArray: function (byteArray) {
      var shortArray = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      var i;
      for (i = 0; i < 16; i++) {
        shortArray[i] = byteArray[i * 2] | byteArray[i * 2 + 1] << 8;
      }
      return shortArray;
    },
    shortArrayToByteArray: function (shortArray) {
      var byteArray = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      var i;
      for (i = 0; i < 16; i++) {
        byteArray[2 * i] = shortArray[i] & 0xff;
        byteArray[2 * i + 1] = shortArray[i] >> 8;
      }

      return byteArray;
    },
    shortArrayToHexString: function (ary) {
      var res = "";
      for (var i = 0; i < ary.length; i++) {
        res += nibbleToChar[(ary[i] >> 4) & 0x0f] + nibbleToChar[ary[i] & 0x0f] + nibbleToChar[(ary[i] >> 12) & 0x0f] + nibbleToChar[(ary[i] >> 8) & 0x0f];
      }
      return res;
    },
  }
}();
/* convert end*/

/* sha256 start*/
/*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
var CryptoJS = CryptoJS || function (h, s) {
  var f = {}, t = f.lib = {}, g = function () { }, j = t.Base = {
    extend: function (a) {
      g.prototype = this;
      var c = new g;
      a && c.mixIn(a);
      c.hasOwnProperty("init") || (c.init = function () {
        c.$super.init.apply(this, arguments)
      });
      c.init.prototype = c;
      c.$super = this;
      return c
    },
    create: function () {
      var a = this.extend();
      a.init.apply(a, arguments);
      return a
    },
    init: function () { },
    mixIn: function (a) {
      for (var c in a) a.hasOwnProperty(c) && (this[c] = a[c]);
      a.hasOwnProperty("toString") && (this.toString = a.toString)
    },
    clone: function () {
      return this.init.prototype.extend(this)
    }
  },
    q = t.WordArray = j.extend({
      init: function (a, c) {
        a = this.words = a || [];
        this.sigBytes = c != s ? c : 4 * a.length
      },
      toString: function (a) {
        return (a || u).stringify(this)
      },
      concat: function (a) {
        var c = this.words,
          d = a.words,
          b = this.sigBytes;
        a = a.sigBytes;
        this.clamp();
        if (b % 4)
          for (var e = 0; e < a; e++) c[b + e >>> 2] |= (d[e >>> 2] >>> 24 - 8 * (e % 4) & 255) << 24 - 8 * ((b + e) % 4);
        else if (65535 < d.length)
          for (e = 0; e < a; e += 4) c[b + e >>> 2] = d[e >>> 2];
        else c.push.apply(c, d);
        this.sigBytes += a;
        return this
      },
      clamp: function () {
        var a = this.words,
          c = this.sigBytes;
        a[c >>> 2] &= 4294967295 <<
          32 - 8 * (c % 4);
        a.length = h.ceil(c / 4)
      },
      clone: function () {
        var a = j.clone.call(this);
        a.words = this.words.slice(0);
        return a
      },
      random: function (a) {
        for (var c = [], d = 0; d < a; d += 4) c.push(4294967296 * h.random() | 0);
        return new q.init(c, a)
      }
    }),
    v = f.enc = {}, u = v.Hex = {
      stringify: function (a) {
        var c = a.words;
        a = a.sigBytes;
        for (var d = [], b = 0; b < a; b++) {
          var e = c[b >>> 2] >>> 24 - 8 * (b % 4) & 255;
          d.push((e >>> 4).toString(16));
          d.push((e & 15).toString(16))
        }
        return d.join("")
      },
      parse: function (a) {
        for (var c = a.length, d = [], b = 0; b < c; b += 2) d[b >>> 3] |= parseInt(a.substr(b,
          2), 16) << 24 - 4 * (b % 8);
        return new q.init(d, c / 2)
      }
    }, k = v.Latin1 = {
      stringify: function (a) {
        var c = a.words;
        a = a.sigBytes;
        for (var d = [], b = 0; b < a; b++) d.push(String.fromCharCode(c[b >>> 2] >>> 24 - 8 * (b % 4) & 255));
        return d.join("")
      },
      parse: function (a) {
        for (var c = a.length, d = [], b = 0; b < c; b++) d[b >>> 2] |= (a.charCodeAt(b) & 255) << 24 - 8 * (b % 4);
        return new q.init(d, c)
      }
    }, l = v.Utf8 = {
      stringify: function (a) {
        try {
          return decodeURIComponent(escape(k.stringify(a)))
        } catch (c) {
          throw Error("Malformed UTF-8 data");
        }
      },
      parse: function (a) {
        return k.parse(unescape(encodeURIComponent(a)))
      }
    },
    x = t.BufferedBlockAlgorithm = j.extend({
      reset: function () {
        this._data = new q.init;
        this._nDataBytes = 0
      },
      _append: function (a) {
        "string" == typeof a && (a = l.parse(a));
        this._data.concat(a);
        this._nDataBytes += a.sigBytes
      },
      _process: function (a) {
        var c = this._data,
          d = c.words,
          b = c.sigBytes,
          e = this.blockSize,
          f = b / (4 * e),
          f = a ? h.ceil(f) : h.max((f | 0) - this._minBufferSize, 0);
        a = f * e;
        b = h.min(4 * a, b);
        if (a) {
          for (var m = 0; m < a; m += e) this._doProcessBlock(d, m);
          m = d.splice(0, a);
          c.sigBytes -= b
        }
        return new q.init(m, b)
      },
      clone: function () {
        var a = j.clone.call(this);
        a._data = this._data.clone();
        return a
      },
      _minBufferSize: 0
    });
  t.Hasher = x.extend({
    cfg: j.extend(),
    init: function (a) {
      this.cfg = this.cfg.extend(a);
      this.reset()
    },
    reset: function () {
      x.reset.call(this);
      this._doReset()
    },
    update: function (a) {
      this._append(a);
      this._process();
      return this
    },
    finalize: function (a) {
      a && this._append(a);
      return this._doFinalize()
    },
    blockSize: 16,
    _createHelper: function (a) {
      return function (c, d) {
        return (new a.init(d)).finalize(c)
      }
    },
    _createHmacHelper: function (a) {
      return function (c, d) {
        return (new w.HMAC.init(a,
          d)).finalize(c)
      }
    }
  });
  var w = f.algo = {};
  return f
}(Math);
(function (h) {
  for (var s = CryptoJS, f = s.lib, t = f.WordArray, g = f.Hasher, f = s.algo, j = [], q = [], v = function (a) {
    return 4294967296 * (a - (a | 0)) | 0
  }, u = 2, k = 0; 64 > k;) {
    var l;
    a: {
      l = u;
      for (var x = h.sqrt(l), w = 2; w <= x; w++)
        if (!(l % w)) {
          l = !1;
          break a
        }
      l = !0
    }
    l && (8 > k && (j[k] = v(h.pow(u, 0.5))), q[k] = v(h.pow(u, 1 / 3)), k++);
    u++
  }
  var a = [],
    f = f.SHA256 = g.extend({
      _doReset: function () {
        this._hash = new t.init(j.slice(0))
      },
      _doProcessBlock: function (c, d) {
        for (var b = this._hash.words, e = b[0], f = b[1], m = b[2], h = b[3], p = b[4], j = b[5], k = b[6], l = b[7], n = 0; 64 > n; n++) {
          if (16 > n) a[n] =
            c[d + n] | 0;
          else {
            var r = a[n - 15],
              g = a[n - 2];
            a[n] = ((r << 25 | r >>> 7) ^ (r << 14 | r >>> 18) ^ r >>> 3) + a[n - 7] + ((g << 15 | g >>> 17) ^ (g << 13 | g >>> 19) ^ g >>> 10) + a[n - 16]
          }
          r = l + ((p << 26 | p >>> 6) ^ (p << 21 | p >>> 11) ^ (p << 7 | p >>> 25)) + (p & j ^ ~p & k) + q[n] + a[n];
          g = ((e << 30 | e >>> 2) ^ (e << 19 | e >>> 13) ^ (e << 10 | e >>> 22)) + (e & f ^ e & m ^ f & m);
          l = k;
          k = j;
          j = p;
          p = h + r | 0;
          h = m;
          m = f;
          f = e;
          e = r + g | 0
        }
        b[0] = b[0] + e | 0;
        b[1] = b[1] + f | 0;
        b[2] = b[2] + m | 0;
        b[3] = b[3] + h | 0;
        b[4] = b[4] + p | 0;
        b[5] = b[5] + j | 0;
        b[6] = b[6] + k | 0;
        b[7] = b[7] + l | 0
      },
      _doFinalize: function () {
        var a = this._data,
          d = a.words,
          b = 8 * this._nDataBytes,
          e = 8 * a.sigBytes;
        d[e >>> 5] |= 128 << 24 - e % 32;
        d[(e + 64 >>> 9 << 4) + 14] = h.floor(b / 4294967296);
        d[(e + 64 >>> 9 << 4) + 15] = b;
        a.sigBytes = 4 * d.length;
        this._process();
        return this._hash
      },
      clone: function () {
        var a = g.clone.call(this);
        a._hash = this._hash.clone();
        return a
      }
    });
  s.SHA256 = g._createHelper(f);
  s.HmacSHA256 = g._createHmacHelper(f)
})(Math);
/* sha 256 end */

/* 25519 start*/


var curve25519_zero = function () {
  return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

var curve25519_one = function () {
  return [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

var curve25519_two = function () {
  return [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

var curve25519_nine = function () {
  return [9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

var curve25519_486671 = function () {
  return [27919, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

var curve25519_39420360 = function () {
  return [33224, 601, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

var curve25519_r2y = function () {
  return [0x1670, 0x4000, 0xf219, 0xd369, 0x2248, 0x4845, 0x679a, 0x884d, 0x5d19, 0x16bf, 0xda74, 0xe57d, 0x5e53, 0x3705, 0x3526, 0x17c0];
}

var curve25519_2y = function () {
  return [0x583b, 0x0262, 0x74bb, 0xac2c, 0x3c9b, 0x2507, 0x6503, 0xdb85, 0x5d66, 0x116e, 0x45a7, 0x3fc2, 0xf296, 0x8ebe, 0xccbc, 0x3ea3];
}

var curve25519_clamp = function (curve) {
  curve[0] &= 0xFFF8;
  curve[15] &= 0x7FFF;
  curve[15] |= 0x4000;
  return curve;
}

var curve25519_getbit = function (curve, c) {
  return ~~(curve[~~(c / 16)] / Math.pow(2, c % 16)) % 2;
}

var curve25519_prime = [0xffff - 18, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0x7fff];

/* group order (a prime near 2^252+2^124) */
var curve25519_order = [
  237, 211, 245, 92, 26, 99, 18, 88, 214, 156, 247, 162, 222, 249, 222, 20,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16];

var curve25519_order_times_8 = [
  104, 159, 174, 231, 210, 24, 147, 192, 178, 230, 188, 23, 245, 206, 247, 166,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128];


var curve25519_convertToByteArray = function (a) {
  var b = new Int8Array(32);
  var i;
  for (i = 0; i < 16; i++) {
    b[2 * i] = a[i] & 0xff;
    b[2 * i + 1] = a[i] >> 8;
  }

  return b;
}

var curve25519_convertToShortArray = function (a) {
  var b = new Array(16);
  var i, val1, val2;
  for (i = 0; i < 16; i++) {
    val1 = a[i * 2];
    if (val1 < 0) {
      val1 += 256;
    }
    val2 = a[i * 2 + 1];
    if (val2 < 0) {
      val2 += 256;
    }
    b[i] = val1 + val2 * 256;
  }
  return b;

}

var curve25519_fillShortArray = function (src, dest) {
  var i;
  for (i = 0; i < 16; i++) {
    dest[i] = src[i];
  }
}

var curve25519_fillByteArray = function (src, dest) {
  var i;
  for (i = 0; i < 32; i++) {
    dest[i] = src[i];
  }
}

var curve25519_cpy32 = function (a) {
  var b = new Int8Array(32);
  var i = 0;
  for (i = 0; i < 32; i++) {
    b[i] = a[i];
  }
  return b;
}

var curve25519_mula_small = function (p, q, m, x, n, z) {
  var v = 0;
  for (var j = 0; j < n; ++j) {
    v += (q[j + m] & 0xFF) + z * (x[j] & 0xFF);
    p[j + m] = (v & 0xFF);
    v >>= 8;
  }
  return v;
}

var curve25519_mula32 = function (p, x, y, t, z) {
  var n = 31;
  var w = 0;
  for (var i = 0; i < t; i++) {
    var zy = z * (y[i] & 0xFF);
    w += curve25519_mula_small(p, p, i, x, n, zy) + (p[i + n] & 0xFF) + zy * (x[n] & 0xFF);
    p[i + n] = (w & 0xFF);
    w >>= 8;
  }
  p[i + n] = ((w + (p[i + n] & 0xFF)) & 0xFF);
  return w >> 8;
}

var curve25519_divmod = function (q, r, n, d, t) {
  var rn = 0, z = 0;
  var dt = ((d[t - 1] & 0xFF) << 8);
  if (t > 1) {
    dt |= (d[t - 2] & 0xFF);
  }
  while (n-- >= t) {
    z = (rn << 16) | ((r[n] & 0xFF) << 8);
    if (n > 0) {
      z |= (r[n - 1] & 0xFF);
    }
    z = parseInt(z / dt);
    rn += curve25519_mula_small(r, r, n - t + 1, d, t, -z);
    q[n - t + 1] = ((z + rn) & 0xFF); // rn is 0 or -1 (underflow)
    curve25519_mula_small(r, r, n - t + 1, d, t, -rn);
    rn = (r[n] & 0xFF);
    r[n] = 0;
  }
  r[t - 1] = (rn & 0xFF);
}

var curve25519_numsize = function (x, n) {
  while (n-- != 0 && x[n] == 0)
    ;
  return n + 1;
}

var curve25519_egcd32 = function (x, y, a, b) {
  var an = 0, bn = 32, qn = 0, i = 0;
  for (i = 0; i < 32; i++) {
    x[i] = y[i] = 0;
  }
  x[0] = 1;
  an = curve25519_numsize(a, 32);
  if (an == 0) {
    return y;	// division by zero
  }
  var temp = new Int8Array(32);
  while (true) {
    qn = bn - an + 1;
    curve25519_divmod(temp, b, bn, a, an);
    bn = curve25519_numsize(b, bn);
    if (bn == 0) {
      return x;
    }
    curve25519_mula32(y, x, temp, qn, -1);

    qn = an - bn + 1;
    curve25519_divmod(temp, a, an, b, bn);
    an = curve25519_numsize(a, an);
    if (an == 0) {
      return y;
    }
    curve25519_mula32(x, y, temp, qn, -1);
  }
}

var curve25519_compare = function (a, b) {
  var c;
  for (c = 15; c >= 0; c--) {
    var x = a[c];
    var y = b[c];
    if (x > y) {
      return 1;
    }
    if (x < y) {
      return -1;
    }
  }
  return 0;
}

var curve25519_cpy16 = function (a) {
  var r = new Array(16);
  var i;
  for (i = 0; i < 16; i++) {
    r[i] = a[i];
  }
  return r;
}

/***
 * BloodyRookie: odd numbers are negativ
 */
var curve25519_isNegative = function (x) {
  return (x[0] & 1);
}

var curve25519_isOverflow = function (x) {
  if (x[15] >= 0x8000) return 1;
  if (x[0] >= 0x10000) {
    var i;
    for (i = 1; i < 15; i++) {
      if (x[i] < 0xFFFF) {
        return 0;
      }
    }
    return 1;
  }
  else {
    return 0;
  }
}

var curve25519_sqr8h = function (r, a7, a6, a5, a4, a3, a2, a1, a0) {
  var v = 0;
  r[0] = (v = a0 * a0) & 0xffff;
  r[1] = (v = ~~(v / 0x10000) + 2 * a0 * a1) & 0xffff;
  r[2] = (v = ~~(v / 0x10000) + 2 * a0 * a2 + a1 * a1) & 0xffff;
  r[3] = (v = ~~(v / 0x10000) + 2 * a0 * a3 + 2 * a1 * a2) & 0xffff;
  r[4] = (v = ~~(v / 0x10000) + 2 * a0 * a4 + 2 * a1 * a3 + a2 * a2) & 0xffff;
  r[5] = (v = ~~(v / 0x10000) + 2 * a0 * a5 + 2 * a1 * a4 + 2 * a2 * a3) & 0xffff;
  r[6] = (v = ~~(v / 0x10000) + 2 * a0 * a6 + 2 * a1 * a5 + 2 * a2 * a4 + a3 * a3) & 0xffff;
  r[7] = (v = ~~(v / 0x10000) + 2 * a0 * a7 + 2 * a1 * a6 + 2 * a2 * a5 + 2 * a3 * a4) & 0xffff;
  r[8] = (v = ~~(v / 0x10000) + 2 * a1 * a7 + 2 * a2 * a6 + 2 * a3 * a5 + a4 * a4) & 0xffff;
  r[9] = (v = ~~(v / 0x10000) + 2 * a2 * a7 + 2 * a3 * a6 + 2 * a4 * a5) & 0xffff;
  r[10] = (v = ~~(v / 0x10000) + 2 * a3 * a7 + 2 * a4 * a6 + a5 * a5) & 0xffff;
  r[11] = (v = ~~(v / 0x10000) + 2 * a4 * a7 + 2 * a5 * a6) & 0xffff;
  r[12] = (v = ~~(v / 0x10000) + 2 * a5 * a7 + a6 * a6) & 0xffff;
  r[13] = (v = ~~(v / 0x10000) + 2 * a6 * a7) & 0xffff;
  r[14] = (v = ~~(v / 0x10000) + a7 * a7) & 0xffff;
  r[15] = ~~(v / 0x10000);
}

var curve25519_sqrmodp = function (r, a) {
  var x = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var y = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var z = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  curve25519_sqr8h(x, a[15], a[14], a[13], a[12], a[11], a[10], a[9], a[8]);
  curve25519_sqr8h(z, a[7], a[6], a[5], a[4], a[3], a[2], a[1], a[0]);
  curve25519_sqr8h(y, a[15] + a[7], a[14] + a[6], a[13] + a[5], a[12] + a[4], a[11] + a[3], a[10] + a[2], a[9] + a[1], a[8] + a[0]);
  var v = 0;
  r[0] = (v = 0x800000 + z[0] + (y[8] - x[8] - z[8] + x[0] - 0x80) * 38) & 0xffff;
  r[1] = (v = 0x7fff80 + ~~(v / 0x10000) + z[1] + (y[9] - x[9] - z[9] + x[1]) * 38) & 0xffff;
  r[2] = (v = 0x7fff80 + ~~(v / 0x10000) + z[2] + (y[10] - x[10] - z[10] + x[2]) * 38) & 0xffff;
  r[3] = (v = 0x7fff80 + ~~(v / 0x10000) + z[3] + (y[11] - x[11] - z[11] + x[3]) * 38) & 0xffff;
  r[4] = (v = 0x7fff80 + ~~(v / 0x10000) + z[4] + (y[12] - x[12] - z[12] + x[4]) * 38) & 0xffff;
  r[5] = (v = 0x7fff80 + ~~(v / 0x10000) + z[5] + (y[13] - x[13] - z[13] + x[5]) * 38) & 0xffff;
  r[6] = (v = 0x7fff80 + ~~(v / 0x10000) + z[6] + (y[14] - x[14] - z[14] + x[6]) * 38) & 0xffff;
  r[7] = (v = 0x7fff80 + ~~(v / 0x10000) + z[7] + (y[15] - x[15] - z[15] + x[7]) * 38) & 0xffff;
  r[8] = (v = 0x7fff80 + ~~(v / 0x10000) + z[8] + y[0] - x[0] - z[0] + x[8] * 38) & 0xffff;
  r[9] = (v = 0x7fff80 + ~~(v / 0x10000) + z[9] + y[1] - x[1] - z[1] + x[9] * 38) & 0xffff;
  r[10] = (v = 0x7fff80 + ~~(v / 0x10000) + z[10] + y[2] - x[2] - z[2] + x[10] * 38) & 0xffff;
  r[11] = (v = 0x7fff80 + ~~(v / 0x10000) + z[11] + y[3] - x[3] - z[3] + x[11] * 38) & 0xffff;
  r[12] = (v = 0x7fff80 + ~~(v / 0x10000) + z[12] + y[4] - x[4] - z[4] + x[12] * 38) & 0xffff;
  r[13] = (v = 0x7fff80 + ~~(v / 0x10000) + z[13] + y[5] - x[5] - z[5] + x[13] * 38) & 0xffff;
  r[14] = (v = 0x7fff80 + ~~(v / 0x10000) + z[14] + y[6] - x[6] - z[6] + x[14] * 38) & 0xffff;
  r[15] = 0x7fff80 + ~~(v / 0x10000) + z[15] + y[7] - x[7] - z[7] + x[15] * 38;
  curve25519_reduce(r);
}

var curve25519_mul8h = function (r, a7, a6, a5, a4, a3, a2, a1, a0, b7, b6, b5, b4, b3, b2, b1, b0) {
  var v = 0;
  r[0] = (v = a0 * b0) & 0xffff;
  r[1] = (v = ~~(v / 0x10000) + a0 * b1 + a1 * b0) & 0xffff;
  r[2] = (v = ~~(v / 0x10000) + a0 * b2 + a1 * b1 + a2 * b0) & 0xffff;
  r[3] = (v = ~~(v / 0x10000) + a0 * b3 + a1 * b2 + a2 * b1 + a3 * b0) & 0xffff;
  r[4] = (v = ~~(v / 0x10000) + a0 * b4 + a1 * b3 + a2 * b2 + a3 * b1 + a4 * b0) & 0xffff;
  r[5] = (v = ~~(v / 0x10000) + a0 * b5 + a1 * b4 + a2 * b3 + a3 * b2 + a4 * b1 + a5 * b0) & 0xffff;
  r[6] = (v = ~~(v / 0x10000) + a0 * b6 + a1 * b5 + a2 * b4 + a3 * b3 + a4 * b2 + a5 * b1 + a6 * b0) & 0xffff;
  r[7] = (v = ~~(v / 0x10000) + a0 * b7 + a1 * b6 + a2 * b5 + a3 * b4 + a4 * b3 + a5 * b2 + a6 * b1 + a7 * b0) & 0xffff;
  r[8] = (v = ~~(v / 0x10000) + a1 * b7 + a2 * b6 + a3 * b5 + a4 * b4 + a5 * b3 + a6 * b2 + a7 * b1) & 0xffff;
  r[9] = (v = ~~(v / 0x10000) + a2 * b7 + a3 * b6 + a4 * b5 + a5 * b4 + a6 * b3 + a7 * b2) & 0xffff;
  r[10] = (v = ~~(v / 0x10000) + a3 * b7 + a4 * b6 + a5 * b5 + a6 * b4 + a7 * b3) & 0xffff;
  r[11] = (v = ~~(v / 0x10000) + a4 * b7 + a5 * b6 + a6 * b5 + a7 * b4) & 0xffff;
  r[12] = (v = ~~(v / 0x10000) + a5 * b7 + a6 * b6 + a7 * b5) & 0xffff;
  r[13] = (v = ~~(v / 0x10000) + a6 * b7 + a7 * b6) & 0xffff;
  r[14] = (v = ~~(v / 0x10000) + a7 * b7) & 0xffff;
  r[15] = ~~(v / 0x10000);
}

var curve25519_mulmodp = function (r, a, b) {
  var x = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var y = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var z = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  curve25519_mul8h(x, a[15], a[14], a[13], a[12], a[11], a[10], a[9], a[8], b[15], b[14], b[13], b[12], b[11], b[10], b[9], b[8]);
  curve25519_mul8h(z, a[7], a[6], a[5], a[4], a[3], a[2], a[1], a[0], b[7], b[6], b[5], b[4], b[3], b[2], b[1], b[0]);
  curve25519_mul8h(y, a[15] + a[7], a[14] + a[6], a[13] + a[5], a[12] + a[4], a[11] + a[3], a[10] + a[2], a[9] + a[1], a[8] + a[0],
    b[15] + b[7], b[14] + b[6], b[13] + b[5], b[12] + b[4], b[11] + b[3], b[10] + b[2], b[9] + b[1], b[8] + b[0]);
  var v = 0;
  r[0] = (v = 0x800000 + z[0] + (y[8] - x[8] - z[8] + x[0] - 0x80) * 38) & 0xffff;
  r[1] = (v = 0x7fff80 + ~~(v / 0x10000) + z[1] + (y[9] - x[9] - z[9] + x[1]) * 38) & 0xffff;
  r[2] = (v = 0x7fff80 + ~~(v / 0x10000) + z[2] + (y[10] - x[10] - z[10] + x[2]) * 38) & 0xffff;
  r[3] = (v = 0x7fff80 + ~~(v / 0x10000) + z[3] + (y[11] - x[11] - z[11] + x[3]) * 38) & 0xffff;
  r[4] = (v = 0x7fff80 + ~~(v / 0x10000) + z[4] + (y[12] - x[12] - z[12] + x[4]) * 38) & 0xffff;
  r[5] = (v = 0x7fff80 + ~~(v / 0x10000) + z[5] + (y[13] - x[13] - z[13] + x[5]) * 38) & 0xffff;
  r[6] = (v = 0x7fff80 + ~~(v / 0x10000) + z[6] + (y[14] - x[14] - z[14] + x[6]) * 38) & 0xffff;
  r[7] = (v = 0x7fff80 + ~~(v / 0x10000) + z[7] + (y[15] - x[15] - z[15] + x[7]) * 38) & 0xffff;
  r[8] = (v = 0x7fff80 + ~~(v / 0x10000) + z[8] + y[0] - x[0] - z[0] + x[8] * 38) & 0xffff;
  r[9] = (v = 0x7fff80 + ~~(v / 0x10000) + z[9] + y[1] - x[1] - z[1] + x[9] * 38) & 0xffff;
  r[10] = (v = 0x7fff80 + ~~(v / 0x10000) + z[10] + y[2] - x[2] - z[2] + x[10] * 38) & 0xffff;
  r[11] = (v = 0x7fff80 + ~~(v / 0x10000) + z[11] + y[3] - x[3] - z[3] + x[11] * 38) & 0xffff;
  r[12] = (v = 0x7fff80 + ~~(v / 0x10000) + z[12] + y[4] - x[4] - z[4] + x[12] * 38) & 0xffff;
  r[13] = (v = 0x7fff80 + ~~(v / 0x10000) + z[13] + y[5] - x[5] - z[5] + x[13] * 38) & 0xffff;
  r[14] = (v = 0x7fff80 + ~~(v / 0x10000) + z[14] + y[6] - x[6] - z[6] + x[14] * 38) & 0xffff;
  r[15] = 0x7fff80 + ~~(v / 0x10000) + z[15] + y[7] - x[7] - z[7] + x[15] * 38;
  curve25519_reduce(r);
}

var curve25519_mulasmall = function (r, a, m) {
  var v = 0;
  r[0] = (v = a[0] * m) & 0xffff;
  r[1] = (v = ~~(v / 0x10000) + a[1] * m) & 0xffff;
  r[2] = (v = ~~(v / 0x10000) + a[2] * m) & 0xffff;
  r[3] = (v = ~~(v / 0x10000) + a[3] * m) & 0xffff;
  r[4] = (v = ~~(v / 0x10000) + a[4] * m) & 0xffff;
  r[5] = (v = ~~(v / 0x10000) + a[5] * m) & 0xffff;
  r[6] = (v = ~~(v / 0x10000) + a[6] * m) & 0xffff;
  r[7] = (v = ~~(v / 0x10000) + a[7] * m) & 0xffff;
  r[8] = (v = ~~(v / 0x10000) + a[8] * m) & 0xffff;
  r[9] = (v = ~~(v / 0x10000) + a[9] * m) & 0xffff;
  r[10] = (v = ~~(v / 0x10000) + a[10] * m) & 0xffff;
  r[11] = (v = ~~(v / 0x10000) + a[11] * m) & 0xffff;
  r[12] = (v = ~~(v / 0x10000) + a[12] * m) & 0xffff;
  r[13] = (v = ~~(v / 0x10000) + a[13] * m) & 0xffff;
  r[14] = (v = ~~(v / 0x10000) + a[14] * m) & 0xffff;
  r[15] = ~~(v / 0x10000) + a[15] * m;
  curve25519_reduce(r);
}

var curve25519_addmodp = function (r, a, b) {
  var v = 0;
  r[0] = (v = (~~(a[15] / 0x8000) + ~~(b[15] / 0x8000)) * 19 + a[0] + b[0]) & 0xffff;
  r[1] = (v = ~~(v / 0x10000) + a[1] + b[1]) & 0xffff;
  r[2] = (v = ~~(v / 0x10000) + a[2] + b[2]) & 0xffff;
  r[3] = (v = ~~(v / 0x10000) + a[3] + b[3]) & 0xffff;
  r[4] = (v = ~~(v / 0x10000) + a[4] + b[4]) & 0xffff;
  r[5] = (v = ~~(v / 0x10000) + a[5] + b[5]) & 0xffff;
  r[6] = (v = ~~(v / 0x10000) + a[6] + b[6]) & 0xffff;
  r[7] = (v = ~~(v / 0x10000) + a[7] + b[7]) & 0xffff;
  r[8] = (v = ~~(v / 0x10000) + a[8] + b[8]) & 0xffff;
  r[9] = (v = ~~(v / 0x10000) + a[9] + b[9]) & 0xffff;
  r[10] = (v = ~~(v / 0x10000) + a[10] + b[10]) & 0xffff;
  r[11] = (v = ~~(v / 0x10000) + a[11] + b[11]) & 0xffff;
  r[12] = (v = ~~(v / 0x10000) + a[12] + b[12]) & 0xffff;
  r[13] = (v = ~~(v / 0x10000) + a[13] + b[13]) & 0xffff;
  r[14] = (v = ~~(v / 0x10000) + a[14] + b[14]) & 0xffff;
  r[15] = ~~(v / 0x10000) + a[15] % 0x8000 + b[15] % 0x8000;
}

var curve25519_submodp = function (r, a, b) {
  var v = 0;
  r[0] = (v = 0x80000 + (~~(a[15] / 0x8000) - ~~(b[15] / 0x8000) - 1) * 19 + a[0] - b[0]) & 0xffff;
  r[1] = (v = ~~(v / 0x10000) + 0x7fff8 + a[1] - b[1]) & 0xffff;
  r[2] = (v = ~~(v / 0x10000) + 0x7fff8 + a[2] - b[2]) & 0xffff;
  r[3] = (v = ~~(v / 0x10000) + 0x7fff8 + a[3] - b[3]) & 0xffff;
  r[4] = (v = ~~(v / 0x10000) + 0x7fff8 + a[4] - b[4]) & 0xffff;
  r[5] = (v = ~~(v / 0x10000) + 0x7fff8 + a[5] - b[5]) & 0xffff;
  r[6] = (v = ~~(v / 0x10000) + 0x7fff8 + a[6] - b[6]) & 0xffff;
  r[7] = (v = ~~(v / 0x10000) + 0x7fff8 + a[7] - b[7]) & 0xffff;
  r[8] = (v = ~~(v / 0x10000) + 0x7fff8 + a[8] - b[8]) & 0xffff;
  r[9] = (v = ~~(v / 0x10000) + 0x7fff8 + a[9] - b[9]) & 0xffff;
  r[10] = (v = ~~(v / 0x10000) + 0x7fff8 + a[10] - b[10]) & 0xffff;
  r[11] = (v = ~~(v / 0x10000) + 0x7fff8 + a[11] - b[11]) & 0xffff;
  r[12] = (v = ~~(v / 0x10000) + 0x7fff8 + a[12] - b[12]) & 0xffff;
  r[13] = (v = ~~(v / 0x10000) + 0x7fff8 + a[13] - b[13]) & 0xffff;
  r[14] = (v = ~~(v / 0x10000) + 0x7fff8 + a[14] - b[14]) & 0xffff;
  r[15] = ~~(v / 0x10000) + 0x7ff8 + a[15] % 0x8000 - b[15] % 0x8000;
}
/****
 * BloodyRookie: a^-1 is found via Fermats little theorem:
 * a^p congruent a mod p and therefore a^(p-2) congruent a^-1 mod p
 */
var curve25519_invmodp = function (r, a, sqrtassist) {
  var r1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var r2 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var r3 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var r4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var r5 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var i = 0;
  curve25519_sqrmodp(r2, a);					//  2 == 2 * 1	
  curve25519_sqrmodp(r3, r2);					//  4 == 2 * 2	
  curve25519_sqrmodp(r1, r3);					//  8 == 2 * 4	
  curve25519_mulmodp(r3, r1, a);				//  9 == 8 + 1	
  curve25519_mulmodp(r1, r3, r2);				// 11 == 9 + 2	
  curve25519_sqrmodp(r2, r1);					// 22 == 2 * 11	
  curve25519_mulmodp(r4, r2, r3);				// 31 == 22 + 9
  //	== 2^5   - 2^0	
  curve25519_sqrmodp(r2, r4);					// 2^6   - 2^1	
  curve25519_sqrmodp(r3, r2);					// 2^7   - 2^2	
  curve25519_sqrmodp(r2, r3);					// 2^8   - 2^3	
  curve25519_sqrmodp(r3, r2);					// 2^9   - 2^4	
  curve25519_sqrmodp(r2, r3);					// 2^10  - 2^5	
  curve25519_mulmodp(r3, r2, r4);				// 2^10  - 2^0	
  curve25519_sqrmodp(r2, r3);					// 2^11  - 2^1	
  curve25519_sqrmodp(r4, r2);					// 2^12  - 2^2	
  for (i = 1; i < 5; i++) {
    curve25519_sqrmodp(r2, r4);
    curve25519_sqrmodp(r4, r2);
  } 											// 2^20  - 2^10	
  curve25519_mulmodp(r2, r4, r3);				// 2^20  - 2^0	
  curve25519_sqrmodp(r4, r2);					// 2^21  - 2^1	
  curve25519_sqrmodp(r5, r4);					// 2^22  - 2^2	
  for (i = 1; i < 10; i++) {
    curve25519_sqrmodp(r4, r5);
    curve25519_sqrmodp(r5, r4);
  } 											// 2^40  - 2^20	
  curve25519_mulmodp(r4, r5, r2);				// 2^40  - 2^0	
  for (i = 0; i < 5; i++) {
    curve25519_sqrmodp(r2, r4);
    curve25519_sqrmodp(r4, r2);
  } 											// 2^50  - 2^10	
  curve25519_mulmodp(r2, r4, r3);				// 2^50  - 2^0	
  curve25519_sqrmodp(r3, r2);					// 2^51  - 2^1	
  curve25519_sqrmodp(r4, r3);					// 2^52  - 2^2	
  for (i = 1; i < 25; i++) {
    curve25519_sqrmodp(r3, r4);
    curve25519_sqrmodp(r4, r3);
  } 											// 2^100 - 2^50 
  curve25519_mulmodp(r3, r4, r2);				// 2^100 - 2^0	
  curve25519_sqrmodp(r4, r3);					// 2^101 - 2^1	
  curve25519_sqrmodp(r5, r4);					// 2^102 - 2^2	
  for (i = 1; i < 50; i++) {
    curve25519_sqrmodp(r4, r5);
    curve25519_sqrmodp(r5, r4);
  } 											// 2^200 - 2^100 
  curve25519_mulmodp(r4, r5, r3);				// 2^200 - 2^0	
  for (i = 0; i < 25; i++) {
    curve25519_sqrmodp(r5, r4);
    curve25519_sqrmodp(r4, r5);
  } 											// 2^250 - 2^50	
  curve25519_mulmodp(r3, r4, r2);				// 2^250 - 2^0	
  curve25519_sqrmodp(r2, r3);					// 2^251 - 2^1	
  curve25519_sqrmodp(r3, r2);					// 2^252 - 2^2	
  if (sqrtassist == 1) {
    curve25519_mulmodp(r, a, r3);				// 2^252 - 3 
  } else {
    curve25519_sqrmodp(r2, r3);					// 2^253 - 2^3	
    curve25519_sqrmodp(r3, r2);					// 2^254 - 2^4	
    curve25519_sqrmodp(r2, r3);					// 2^255 - 2^5	
    curve25519_mulmodp(r, r2, r1);				// 2^255 - 21	
  }
}

/******
 * BloodyRookie: Finding a square root mod p of x if we already know it exists and p congruent 3 mod 8.
 * Using x^((p-1)/2) congruent 1 mod p and 2^((p-1)/2) congruent -1 mod p
 * because of Eulers criterium we see that when we set v=(2x)^((p-5)/8) then
 * i:=2xv^2 is a square root of -1 and thus r=+xv(i-1) and r=-xv(i-1) are the square roots of x.
 */
var curve25519_sqrtmodp = function (r, x) {
  var r1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var r2 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var r3 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var r4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  curve25519_addmodp(r1, x, x);								// r1 = 2x
  curve25519_invmodp(r2, r1, 1);							// r2 = (2x)^((p-5)/8) =: v
  curve25519_sqrmodp(r3, r2);								// r3 = v^2
  curve25519_mulmodp(r4, r1, r3);							// r4 = 2xv^2 =: i
  curve25519_submodp(r, r4, curve25519_one());				//  r = i-1
  curve25519_mulmodp(r1, r2, r);							// r1 = v(i-1)
  curve25519_mulmodp(r, x, r1);								//  r = xv(i-1)
}

var curve25519_reduce = function (a) {
  curve25519_reduce2(a);

  /**
   * BloodyRookie: special case for p <= a < 2^255
   */
  if ((a[15] != 0x7FFF || a[14] != 0xFFFF || a[13] != 0xFFFF || a[12] != 0xFFFF || a[11] != 0xFFFF || a[10] != 0xFFFF || a[9] != 0xFFFF || a[8] != 0xFFFF ||
    a[7] != 0xFFFF || a[6] != 0xFFFF || a[5] != 0xFFFF || a[4] != 0xFFFF || a[3] != 0xFFFF || a[2] != 0xFFFF || a[1] != 0xFFFF || a[0] < 0xFFED)) {
    return;
  }

  var i;
  for (i = 1; i < 16; i++) {
    a[i] = 0;
  }
  a[0] = a[0] - 0xFFED;
}
var curve25519_reduce2 = function (a) {
  var v = a[15];
  if (v < 0x8000) return;
  a[15] = v % 0x8000;
  v = ~~(v / 0x8000) * 19;
  a[0] = (v += a[0]) & 0xffff;
  if ((v = ~~(v / 0x10000)) < 1) return;
  a[1] = (v += a[1]) & 0xffff;
  if ((v = ~~(v / 0x10000)) < 1) return;
  a[2] = (v += a[2]) & 0xffff;
  if ((v = ~~(v / 0x10000)) < 1) return;
  a[3] = (v += a[3]) & 0xffff;
  if ((v = ~~(v / 0x10000)) < 1) return;
  a[4] = (v += a[4]) & 0xffff;
  if ((v = ~~(v / 0x10000)) < 1) return;
  a[5] = (v += a[5]) & 0xffff;
  if ((v = ~~(v / 0x10000)) < 1) return;
  a[6] = (v += a[6]) & 0xffff;
  if ((v = ~~(v / 0x10000)) < 1) return;
  a[7] = (v += a[7]) & 0xffff;
  if ((v = ~~(v / 0x10000)) < 1) return;
  a[8] = (v += a[8]) & 0xffff;
  if ((v = ~~(v / 0x10000)) < 1) return;
  a[9] = (v += a[9]) & 0xffff;
  if ((v = ~~(v / 0x10000)) < 1) return;
  a[10] = (v += a[10]) & 0xffff;
  if ((v = ~~(v / 0x10000)) < 1) return;
  a[11] = (v += a[11]) & 0xffff;
  if ((v = ~~(v / 0x10000)) < 1) return;
  a[12] = (v += a[12]) & 0xffff;
  if ((v = ~~(v / 0x10000)) < 1) return;
  a[13] = (v += a[13]) & 0xffff;
  if ((v = ~~(v / 0x10000)) < 1) return;
  a[14] = (v += a[14]) & 0xffff;
  if ((v = ~~(v / 0x10000)) < 1) return;
  a[15] += v;
}

/**
 * Montgomery curve with A=486662 and B=1
 */
var curve25519_x_to_y2 = function (r, x) {
  var r1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var r2 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  curve25519_sqrmodp(r1, x);									// r1 = x^2
  curve25519_mulasmall(r2, x, 486662);							// r2 = Ax
  curve25519_addmodp(r, r1, r2);								//  r = x^2 + Ax
  curve25519_addmodp(r1, r, curve25519_one());					// r1 = x^2 + Ax + 1
  curve25519_mulmodp(r, r1, x);									//  r = x^3 + Ax^2 + x
}

var curve25519_prep = function (r, s, a, b) {
  curve25519_addmodp(r, a, b);
  curve25519_submodp(s, a, b);
}

/****
 * BloodyRookie: Doubling a point on a Montgomery curve:
 * Point is given in projective coordinates p=x/z
 * 2*P = r/s, 
 * r = (x+z)^2 * (x-z)^2
 * s = ((((x+z)^2 - (x-z)^2) * 121665) + (x+z)^2) * ((x+z)^2 - (x-z)^2) 
 *   = 4*x*z * (x^2 + 486662*x*z + z^2)
 *   = 4*x*z * ((x-z)^2 + ((486662+2)/4)(4*x*z))
 */
var curve25519_dbl = function (r, s, t1, t2) {
  var r1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var r2 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var r3 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var r4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  curve25519_sqrmodp(r1, t1);									// r1 = t1^2
  curve25519_sqrmodp(r2, t2);									// r2 = t2^2
  curve25519_submodp(r3, r1, r2);								// r3 = t1^2 - t2^2
  curve25519_mulmodp(r, r2, r1);								//  r = t1^2 * t2^2
  curve25519_mulasmall(r2, r3, 121665);							// r2 = (t1^2 - t2^2) * 121665
  curve25519_addmodp(r4, r2, r1)								// r4 = (t1^2 - t2^2) * 121665 + t1^2
  curve25519_mulmodp(s, r4, r3);								//  s = ((t1^2 - t2^2) * 121665 + t1^2) * (t1^2 - t2^2)
}

/****
 * BloodyRookie: Adding 2 points on a Montgomery curve:
 * R = Q + P = r/s when given
 * Q = x/z, P = x_p/z_p, P-Q = x_1/1
 * r = ((x-z)*(x_p+z_p) + (x+z)*(x_p-z_p))^2
 * s = x_1*((x-z)*(x_p+z_p) - (x+z)*(x_p-z_p))^2
 */
function curve25519_sum(r, s, t1, t2, t3, t4, x_1) {
  var r1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var r2 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var r3 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var r4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  curve25519_mulmodp(r1, t2, t3);								// r1 = t2 * t3
  curve25519_mulmodp(r2, t1, t4);								// r2 = t1 * t4
  curve25519_addmodp(r3, r1, r2);								// r3 = t2 * t3 + t1 * t4
  curve25519_submodp(r4, r1, r2);								// r4 = t2 * t3 - t1 * t4
  curve25519_sqrmodp(r, r3);									//  r = (t2 * t3 + t1 * t4)^2
  curve25519_sqrmodp(r1, r4);									// r1 = (t2 * t3 - t1 * t4)^2
  curve25519_mulmodp(s, r1, x_1);								//  s = (t2 * t3 - t1 * t4)^2 * x_1
}

function curve25519_(f, c, s) {
  var j, a, x_1, q, fb, counter = 0;
  var t = new Array(16), t1 = new Array(16), t2 = new Array(16), t3 = new Array(16), t4 = new Array(16);
  var sb = new Int8Array(32);
  var temp1 = new Int8Array(32);
  var temp2 = new Int8Array(64);
  var temp3 = new Int8Array(64);

  x_1 = c;
  q = [curve25519_one(), curve25519_zero()];
  a = [x_1, curve25519_one()];

  var n = 255;

  /**********************************************************************
   * BloodyRookie:                                                      *
   * Given f = f0*2^0 + f1*2^1 + ... + f255*2^255 and Basepoint a=9/1   * 
   * calculate f*a by applying the Montgomery ladder (const time algo): *
   * r0 := 0 (point at infinity)                                        *
   * r1 := a                                                            *
   * for i from 255 to 0 do                                             *
   *   if fi = 0 then                                                   *
   *      r1 := r0 + r1                                                 *          
   *      r0 := 2r0                                                     *
   *   else                                                             *
   *      r0 := r0 + r1                                                 *
   *      r1 := 2r1                                                     *
   *                                                                    *
   * Result: r0 = x-coordinate of f*a                                   *
   **********************************************************************/
  var r0 = new Array(new Array(16), new Array(16));
  var r1 = new Array(new Array(16), new Array(16));
  var t1 = new Array(16), t2 = new Array(16);
  var t3 = new Array(16), t4 = new Array(16);
  var fi;
  while (n >= 0) {
    fi = curve25519_getbit(f, n);
    if (fi == 0) {
      curve25519_prep(t1, t2, a[0], a[1]);
      curve25519_prep(t3, t4, q[0], q[1]);
      curve25519_sum(r1[0], r1[1], t1, t2, t3, t4, x_1);
      curve25519_dbl(r0[0], r0[1], t3, t4);
    }
    else {
      curve25519_prep(t1, t2, q[0], q[1]);
      curve25519_prep(t3, t4, a[0], a[1]);
      curve25519_sum(r0[0], r0[1], t1, t2, t3, t4, x_1);
      curve25519_dbl(r1[0], r1[1], t3, t4);
    }
    q = r0; a = r1;
    n--;
  }
  curve25519_invmodp(t, q[1], 0);
  curve25519_mulmodp(t1, q[0], t);
  q[0] = curve25519_cpy16(t1);

  // q[0]=x-coordinate of k*G=:Px
  // q[1]=z-coordinate of k*G=:Pz
  // a = q + G = P + G
  if (s != null) {
	  /*************************************************************************
	   * BloodyRookie: Recovery of the y-coordinate of point P:                *
	   *                                                                       *
	   * If P=(x,y), P1=(x1, y1), P2=(x2,y2) and P2 = P1 + P then              *
	   *                                                                       *
	   * y1 = ((x1 * x + 1)(x1 + x + 2A) - 2A - (x1 - x)^2 * x2)/2y            *
	   *                                                                       *
	   * Setting P2=Q, P1=P and P=G in the above formula we get                *
	   *                                                                       *
	   * Py =  ((Px * Gx + 1) * (Px + Gx + 2A) - 2A - (Px - Gx)^2 * Qx)/(2*Gy) *
	   *    = -((Qx + Px + Gx + A) * (Px - Gx)^2 - Py^2 - Gy^2)/(2*Gy)         *
	   *************************************************************************/
    t = curve25519_cpy16(q[0]);
    curve25519_x_to_y2(t1, t);								// t1 = Py^2
    curve25519_invmodp(t3, a[1], 0);
    curve25519_mulmodp(t2, a[0], t3);							// t2 = (P+G)x = Qx
    curve25519_addmodp(t4, t2, t);							// t4 =  Qx + Px
    curve25519_addmodp(t2, t4, curve25519_486671());			// t2 = Qx + Px + Gx + A  
    curve25519_submodp(t4, t, curve25519_nine());				// t4 = Px - Gx
    curve25519_sqrmodp(t3, t4);								// t3 = (Px - Gx)^2
    curve25519_mulmodp(t4, t2, t3);							// t4 = (Qx + Px + Gx + A) * (Px - Gx)^2
    curve25519_submodp(t, t4, t1);							//  t = (Qx + Px + Gx + A) * (Px - Gx)^2 - Py^2
    curve25519_submodp(t4, t, curve25519_39420360());			// t4 = (Qx + Px + Gx + A) * (Px - Gx)^2 - Py^2 - Gy^2
    curve25519_mulmodp(t1, t4, curve25519_r2y())				// t1 = ((Qx + Px + Gx + A) * (Px - Gx)^2 - Py^2 - Gy^2)/(2Gy) = -Py
    fb = curve25519_convertToByteArray(f);
    j = curve25519_isNegative(t1);
    if (j != 0) {
		  /***
		   * Py is positiv, so just copy
		   */
      sb = curve25519_cpy32(fb);
    }
    else {
		  /***
		   * Py is negative:
		   * We will take s = -f^-1 mod q instead of s=f^-1 mod q
		   */
      curve25519_mula_small(sb, curve25519_order_times_8, 0, fb, 32, -1);
    }

    temp1 = curve25519_cpy32(curve25519_order);
    temp1 = curve25519_egcd32(temp2, temp3, sb, temp1);
    sb = curve25519_cpy32(temp1);
    if ((sb[31] & 0x80) != 0) {
      curve25519_mula_small(sb, sb, 0, curve25519_order, 32, 1);
    }
    var stmp = curve25519_convertToShortArray(sb);
    curve25519_fillShortArray(stmp, s);
  }

  return q[0];
}

var curve25519_keygen = function (s, curve) {
  curve25519_clamp(curve);
  return curve25519_(curve, curve25519_nine(), s);
}

/* Signature generation primitive, calculates (x-h)s mod q
 *   v  [out] signature value
 *   h  [in]  signature hash (of message, signature pub key, and context data)
 *   x  [in]  signature private key
 *   s  [in]  private key for signing
 * returns true on success, false on failure (use different x or h)
 */
var curve25519_sign = function (v, h, x, s) {
  var tmp1 = new Int8Array(65);
  var tmp2 = new Int8Array(33);
  for (var i = 0; i < 32; i++) {
    v[i] = 0;
  }
  curve25519_mula_small(v, x, 0, h, 32, -1);
  curve25519_mula_small(v, v, 0, curve25519_order, 32, parseInt((15 - v[31]) / 16));
  curve25519_mula32(tmp1, v, s, 32, 1);
  curve25519_divmod(tmp2, tmp1, 64, curve25519_order, 32);
  var w = 0;
  for (var k = 0; k < 32; k++) {
    v[k] = tmp1[k];
    w |= v[k];
  }
  return w != 0;
}

var curve25519_verify = function (Y, v, h, P) {
  var d = new Int8Array(32);
  var yx = new Array(new Array(16), new Array(16), new Array(16));
  var yz = new Array(new Array(16), new Array(16), new Array(16));
  var s = new Array(new Array(16), new Array(16));
  var q = new Array(new Array(16), new Array(16));
  var t1 = new Array(new Array(16), new Array(16), new Array(16));
  var t2 = new Array(new Array(16), new Array(16), new Array(16));
  var vi = 0, hi = 0, di = 0, nvh = 0, i = 0, j = 0, k = 0, counter = 1;

	/******************************************************************
     * Set s[0] to P+G and s[1] to P-G.                               *
     * If sqrt(Py^2) is negativ we switch s[0] and s[1]               *
	 *                                                                *
     * s[0] = (Py^2 + Gy^2 - 2 Py Gy)/(Px - Gx)^2 - Px - Gx - 486662  *
     * s[1] = (Py^2 + Gy^2 + 2 Py Gy)/(Px - Gx)^2 - Px - Gx - 486662  *
     ******************************************************************/

  var p = [curve25519_nine(), curve25519_convertToShortArray(P)];
  curve25519_x_to_y2(q[0], p[1]);								// q[0] = Py^2
  curve25519_sqrtmodp(t1[0], q[0]);							// t1[0] = +-Py
  j = curve25519_isNegative(t1[0]);
  curve25519_addmodp(t2[0], q[0], curve25519_39420360());		// t2[0] = Py^2 + Gy^2
  curve25519_mulmodp(t2[1], curve25519_2y(), t1[0]);			// t2[1] = +-Py * 2Gy
  curve25519_submodp(t1[j], t2[0], t2[1]);					// t1[j] = Py^2 + Gy^2 - +-Py * 2Gy
  curve25519_addmodp(t1[1 - j], t2[0], t2[1]);					// t1[1-j] = Py^2 + Gy^2 + +-Py * 2Gy
  q[0] = curve25519_cpy16(p[1]);								// q[0] = Px
  curve25519_submodp(t2[0], q[0], curve25519_nine());			// t2[0] = Px-Gx
  curve25519_sqrmodp(t2[1], t2[0]);							// t2[1] = (Px-Gx)^2
  curve25519_invmodp(t2[0], t2[1], 0);						// t2[0] = 1/(Px-Gx)^2
  curve25519_mulmodp(q[0], t1[0], t2[0]);						// q[0] = (Py^2 + Gy^2 - Py * 2Gy)/(Px-Gx)^2
  curve25519_submodp(q[1], q[0], p[1]);						// q[1] = (Py^2 + Gy^2 - Py * 2Gy)/(Px-Gx)^2 - Px
  curve25519_submodp(s[0], q[1], curve25519_486671());		// s[0] = (Py^2 + Gy^2 - Py * 2Gy)/(Px-Gx)^2 - Px - Gx - A = P+Q
  curve25519_mulmodp(q[0], t1[1], t2[0]);						// q[0] = (Py^2 + Gy^2 + Py * 2Gy)/(Px-Gx)^2
  curve25519_submodp(q[1], q[0], p[1]);						// q[1] = (Py^2 + Gy^2 + Py * 2Gy)/(Px-Gx)^2 - Px
  curve25519_submodp(s[1], q[1], curve25519_486671());		// s[1] = (Py^2 + Gy^2 + Py * 2Gy)/(Px-Gx)^2 - Px - Gx - A = P-Q

	/**
	 * Fast algorithm for computing vP+hG
	 */
  for (i = 0; i < 32; i++) {
    vi = (vi >> 8) ^ (v[i] & 0xFF) ^ ((v[i] & 0xFF) << 1);
    hi = (hi >> 8) ^ (h[i] & 0xFF) ^ ((h[i] & 0xFF) << 1);
    nvh = ~(vi ^ hi);
    di = (nvh & (di & 0x80) >> 7) ^ vi;
    di ^= nvh & (di & 0x01) << 1;
    di ^= nvh & (di & 0x02) << 1;
    di ^= nvh & (di & 0x04) << 1;
    di ^= nvh & (di & 0x08) << 1;
    di ^= nvh & (di & 0x10) << 1;
    di ^= nvh & (di & 0x20) << 1;
    di ^= nvh & (di & 0x40) << 1;
    d[i] = (di & 0xFF);
  }

  di = ((nvh & (di & 0x80) << 1) ^ vi) >> 8;

	/**
	 * yx[0]/yz[0] = point at infinity
	 */
  yx[0] = curve25519_cpy16(curve25519_one());
  yx[1] = curve25519_cpy16(p[di]);
  yx[2] = curve25519_cpy16(s[0]);
  yz[0] = curve25519_cpy16(curve25519_zero());
  yz[1] = curve25519_cpy16(curve25519_one());
  yz[2] = curve25519_cpy16(curve25519_one());

  vi = 0;
  hi = 0;

  for (i = 32; i-- != 0; i = i) {
    vi = (vi << 8) | (v[i] & 0xFF);
    hi = (hi << 8) | (h[i] & 0xFF);
    di = (di << 8) | (d[i] & 0xFF);

    for (j = 8; j-- != 0; j = j) {
      k = ((vi ^ vi >> 1) >> j & 1) + ((hi ^ hi >> 1) >> j & 1);
      curve25519_prep(t1[0], t2[0], yx[0], yz[0]);
      curve25519_prep(t1[1], t2[1], yx[1], yz[1]);
      curve25519_prep(t1[2], t2[2], yx[2], yz[2]);

      curve25519_dbl(yx[0], yz[0], t1[k], t2[k]);
      k = (di >> j & 2) ^ ((di >> j & 1) << 1);
      curve25519_sum(yx[1], yz[1], t1[1], t2[1], t1[k], t2[k], p[di >> j & 1]);
      curve25519_sum(yx[2], yz[2], t1[2], t2[2], t1[0], t2[0], s[((vi ^ hi) >> j & 2) >> 1]);
    }
  }

  k = (vi & 1) + (hi & 1);
  curve25519_invmodp(t1[0], yz[k], 0);
  curve25519_mulmodp(t1[1], yx[k], t1[0]);
  var YY = curve25519_convertToByteArray(t1[1]);
  curve25519_fillByteArray(YY, Y);
}

var curve25519 = function () {

  //region Constants

  var KEY_SIZE = 32;

  /* array length */
  var UNPACKED_SIZE = 16;

  /* group order (a prime near 2^252+2^124) */
  var ORDER = [
    237, 211, 245, 92,
    26, 99, 18, 88,
    214, 156, 247, 162,
    222, 249, 222, 20,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 16
  ];

  /* smallest multiple of the order that's >= 2^255 */
  var ORDER_TIMES_8 = [
    104, 159, 174, 231,
    210, 24, 147, 192,
    178, 230, 188, 23,
    245, 206, 247, 166,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 128
  ];

  /* constants 2Gy and 1/(2Gy) */
  var BASE_2Y = [
    22587, 610, 29883, 44076,
    15515, 9479, 25859, 56197,
    23910, 4462, 17831, 16322,
    62102, 36542, 52412, 16035
  ];

  var BASE_R2Y = [
    5744, 16384, 61977, 54121,
    8776, 18501, 26522, 34893,
    23833, 5823, 55924, 58749,
    24147, 14085, 13606, 6080
  ];

  var C1 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var C9 = [9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var C486671 = [0x6D0F, 0x0007, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var C39420360 = [0x81C8, 0x0259, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  var P25 = 33554431; /* (1 << 25) - 1 */
  var P26 = 67108863; /* (1 << 26) - 1 */

  //#endregion

  //region Key Agreement

  /* Private key clamping
   *   k [out] your private key for key agreement
   *   k  [in]  32 random bytes
   */
  function clamp(k) {
    k[31] &= 0x7F;
    k[31] |= 0x40;
    k[0] &= 0xF8;
  }

  //endregion

  //region radix 2^8 math

  function cpy32(d, s) {
    for (var i = 0; i < 32; i++)
      d[i] = s[i];
  }

  /* p[m..n+m-1] = q[m..n+m-1] + z * x */
  /* n is the size of x */
  /* n+m is the size of p and q */
  function mula_small(p, q, m, x, n, z) {
    m = m | 0;
    n = n | 0;
    z = z | 0;

    var v = 0;
    for (var i = 0; i < n; ++i) {
      v += (q[i + m] & 0xFF) + z * (x[i] & 0xFF);
      p[i + m] = (v & 0xFF);
      v >>= 8;
    }

    return v;
  }

  /* p += x * y * z  where z is a small integer
   * x is size 32, y is size t, p is size 32+t
   * y is allowed to overlap with p+32 if you don't care about the upper half  */
  function mula32(p, x, y, t, z) {
    t = t | 0;
    z = z | 0;

    var n = 31;
    var w = 0;
    var i = 0;
    for (; i < t; i++) {
      var zy = z * (y[i] & 0xFF);
      w += mula_small(p, p, i, x, n, zy) + (p[i + n] & 0xFF) + zy * (x[n] & 0xFF);
      p[i + n] = w & 0xFF;
      w >>= 8;
    }
    p[i + n] = (w + (p[i + n] & 0xFF)) & 0xFF;
    return w >> 8;
  }

  /* divide r (size n) by d (size t), returning quotient q and remainder r
   * quotient is size n-t+1, remainder is size t
   * requires t > 0 && d[t-1] !== 0
   * requires that r[-1] and d[-1] are valid memory locations
   * q may overlap with r+t */
  function divmod(q, r, n, d, t) {
    n = n | 0;
    t = t | 0;

    var rn = 0;
    var dt = (d[t - 1] & 0xFF) << 8;
    if (t > 1)
      dt |= (d[t - 2] & 0xFF);

    while (n-- >= t) {
      var z = (rn << 16) | ((r[n] & 0xFF) << 8);
      if (n > 0)
        z |= (r[n - 1] & 0xFF);

      var i = n - t + 1;
      z /= dt;
      rn += mula_small(r, r, i, d, t, -z);
      q[i] = (z + rn) & 0xFF;
      /* rn is 0 or -1 (underflow) */
      mula_small(r, r, i, d, t, -rn);
      rn = r[n] & 0xFF;
      r[n] = 0;
    }

    r[t - 1] = rn & 0xFF;
  }

  function numsize(x, n) {
    while (n-- !== 0 && x[n] === 0) { }
    return n + 1;
  }

  /* Returns x if a contains the gcd, y if b.
   * Also, the returned buffer contains the inverse of a mod b,
   * as 32-byte signed.
   * x and y must have 64 bytes space for temporary use.
   * requires that a[-1] and b[-1] are valid memory locations  */
  function egcd32(x, y, a, b) {
    var an, bn = 32, qn, i;
    for (i = 0; i < 32; i++)
      x[i] = y[i] = 0;
    x[0] = 1;
    an = numsize(a, 32);
    if (an === 0)
      return y; /* division by zero */
    var temp = new Array(32);
    while (true) {
      qn = bn - an + 1;
      divmod(temp, b, bn, a, an);
      bn = numsize(b, bn);
      if (bn === 0)
        return x;
      mula32(y, x, temp, qn, -1);

      qn = an - bn + 1;
      divmod(temp, a, an, b, bn);
      an = numsize(a, an);
      if (an === 0)
        return y;
      mula32(x, y, temp, qn, -1);
    }
  }

  //endregion

  //region radix 2^25.5 GF(2^255-19) math

  //region pack / unpack

  /* Convert to internal format from little-endian byte format */
  function unpack(x, m) {
    for (var i = 0; i < KEY_SIZE; i += 2)
      x[i / 2] = m[i] & 0xFF | ((m[i + 1] & 0xFF) << 8);
  }

  /* Check if reduced-form input >= 2^255-19 */
  function is_overflow(x) {
    return (
      ((x[0] > P26 - 19)) &&
      ((x[1] & x[3] & x[5] & x[7] & x[9]) === P25) &&
      ((x[2] & x[4] & x[6] & x[8]) === P26)
    ) || (x[9] > P25);
  }

  /* Convert from internal format to little-endian byte format.  The
   * number must be in a reduced form which is output by the following ops:
   *     unpack, mul, sqr
   *     set --  if input in range 0 .. P25
   * If you're unsure if the number is reduced, first multiply it by 1.  */
  function pack(x, m) {
    for (var i = 0; i < UNPACKED_SIZE; ++i) {
      m[2 * i] = x[i] & 0x00FF;
      m[2 * i + 1] = (x[i] & 0xFF00) >> 8;
    }
  }

  //endregion

  function createUnpackedArray() {
    return new Uint16Array(UNPACKED_SIZE);
  }

  /* Copy a number */
  function cpy(d, s) {
    for (var i = 0; i < UNPACKED_SIZE; ++i)
      d[i] = s[i];
  }

  /* Set a number to value, which must be in range -185861411 .. 185861411 */
  function set(d, s) {
    d[0] = s;
    for (var i = 1; i < UNPACKED_SIZE; ++i)
      d[i] = 0;
  }

  /* Add/subtract two numbers.  The inputs must be in reduced form, and the
   * output isn't, so to do another addition or subtraction on the output,
   * first multiply it by one to reduce it. */
  var add = c255laddmodp;
  var sub = c255lsubmodp;

  /* Multiply a number by a small integer in range -185861411 .. 185861411.
   * The output is in reduced form, the input x need not be.  x and xy may point
   * to the same buffer. */
  var mul_small = c255lmulasmall;

  /* Multiply two numbers.  The output is in reduced form, the inputs need not be. */
  var mul = c255lmulmodp;

  /* Square a number.  Optimization of  mul25519(x2, x, x)  */
  var sqr = c255lsqrmodp;

  /* Calculates a reciprocal.  The output is in reduced form, the inputs need not
   * be.  Simply calculates  y = x^(p-2)  so it's not too fast. */
  /* When sqrtassist is true, it instead calculates y = x^((p-5)/8) */
  function recip(y, x, sqrtassist) {
    var t0 = createUnpackedArray();
    var t1 = createUnpackedArray();
    var t2 = createUnpackedArray();
    var t3 = createUnpackedArray();
    var t4 = createUnpackedArray();

    /* the chain for x^(2^255-21) is straight from djb's implementation */
    var i;
    sqr(t1, x); /*  2 === 2 * 1	*/
    sqr(t2, t1); /*  4 === 2 * 2	*/
    sqr(t0, t2); /*  8 === 2 * 4	*/
    mul(t2, t0, x); /*  9 === 8 + 1	*/
    mul(t0, t2, t1); /* 11 === 9 + 2	*/
    sqr(t1, t0); /* 22 === 2 * 11	*/
    mul(t3, t1, t2); /* 31 === 22 + 9 === 2^5   - 2^0	*/
    sqr(t1, t3); /* 2^6   - 2^1	*/
    sqr(t2, t1); /* 2^7   - 2^2	*/
    sqr(t1, t2); /* 2^8   - 2^3	*/
    sqr(t2, t1); /* 2^9   - 2^4	*/
    sqr(t1, t2); /* 2^10  - 2^5	*/
    mul(t2, t1, t3); /* 2^10  - 2^0	*/
    sqr(t1, t2); /* 2^11  - 2^1	*/
    sqr(t3, t1); /* 2^12  - 2^2	*/
    for (i = 1; i < 5; i++) {
      sqr(t1, t3);
      sqr(t3, t1);
    } /* t3 */ /* 2^20  - 2^10	*/
    mul(t1, t3, t2); /* 2^20  - 2^0	*/
    sqr(t3, t1); /* 2^21  - 2^1	*/
    sqr(t4, t3); /* 2^22  - 2^2	*/
    for (i = 1; i < 10; i++) {
      sqr(t3, t4);
      sqr(t4, t3);
    } /* t4 */ /* 2^40  - 2^20	*/
    mul(t3, t4, t1); /* 2^40  - 2^0	*/
    for (i = 0; i < 5; i++) {
      sqr(t1, t3);
      sqr(t3, t1);
    } /* t3 */ /* 2^50  - 2^10	*/
    mul(t1, t3, t2); /* 2^50  - 2^0	*/
    sqr(t2, t1); /* 2^51  - 2^1	*/
    sqr(t3, t2); /* 2^52  - 2^2	*/
    for (i = 1; i < 25; i++) {
      sqr(t2, t3);
      sqr(t3, t2);
    } /* t3 */ /* 2^100 - 2^50 */
    mul(t2, t3, t1); /* 2^100 - 2^0	*/
    sqr(t3, t2); /* 2^101 - 2^1	*/
    sqr(t4, t3); /* 2^102 - 2^2	*/
    for (i = 1; i < 50; i++) {
      sqr(t3, t4);
      sqr(t4, t3);
    } /* t4 */ /* 2^200 - 2^100 */
    mul(t3, t4, t2); /* 2^200 - 2^0	*/
    for (i = 0; i < 25; i++) {
      sqr(t4, t3);
      sqr(t3, t4);
    } /* t3 */ /* 2^250 - 2^50	*/
    mul(t2, t3, t1); /* 2^250 - 2^0	*/
    sqr(t1, t2); /* 2^251 - 2^1	*/
    sqr(t2, t1); /* 2^252 - 2^2	*/
    if (sqrtassist !== 0) {
      mul(y, x, t2); /* 2^252 - 3 */
    } else {
      sqr(t1, t2); /* 2^253 - 2^3	*/
      sqr(t2, t1); /* 2^254 - 2^4	*/
      sqr(t1, t2); /* 2^255 - 2^5	*/
      mul(y, t1, t0); /* 2^255 - 21	*/
    }
  }

  /* checks if x is "negative", requires reduced input */
  function is_negative(x) {
    var isOverflowOrNegative = is_overflow(x) || x[9] < 0;
    var leastSignificantBit = x[0] & 1;
    return ((isOverflowOrNegative ? 1 : 0) ^ leastSignificantBit) & 0xFFFFFFFF;
  }

  /* a square root */
  function sqrt(x, u) {
    var v = createUnpackedArray();
    var t1 = createUnpackedArray();
    var t2 = createUnpackedArray();

    add(t1, u, u); /* t1 = 2u		*/
    recip(v, t1, 1); /* v = (2u)^((p-5)/8)	*/
    sqr(x, v); /* x = v^2		*/
    mul(t2, t1, x); /* t2 = 2uv^2		*/
    sub(t2, t2, C1); /* t2 = 2uv^2-1		*/
    mul(t1, v, t2); /* t1 = v(2uv^2-1)	*/
    mul(x, u, t1); /* x = uv(2uv^2-1)	*/
  }

  //endregion

  //region JavaScript Fast Math

  function c255lsqr8h(a7, a6, a5, a4, a3, a2, a1, a0) {
    var r = [];
    var v;
    r[0] = (v = a0 * a0) & 0xFFFF;
    r[1] = (v = ((v / 0x10000) | 0) + 2 * a0 * a1) & 0xFFFF;
    r[2] = (v = ((v / 0x10000) | 0) + 2 * a0 * a2 + a1 * a1) & 0xFFFF;
    r[3] = (v = ((v / 0x10000) | 0) + 2 * a0 * a3 + 2 * a1 * a2) & 0xFFFF;
    r[4] = (v = ((v / 0x10000) | 0) + 2 * a0 * a4 + 2 * a1 * a3 + a2 * a2) & 0xFFFF;
    r[5] = (v = ((v / 0x10000) | 0) + 2 * a0 * a5 + 2 * a1 * a4 + 2 * a2 * a3) & 0xFFFF;
    r[6] = (v = ((v / 0x10000) | 0) + 2 * a0 * a6 + 2 * a1 * a5 + 2 * a2 * a4 + a3 * a3) & 0xFFFF;
    r[7] = (v = ((v / 0x10000) | 0) + 2 * a0 * a7 + 2 * a1 * a6 + 2 * a2 * a5 + 2 * a3 * a4) & 0xFFFF;
    r[8] = (v = ((v / 0x10000) | 0) + 2 * a1 * a7 + 2 * a2 * a6 + 2 * a3 * a5 + a4 * a4) & 0xFFFF;
    r[9] = (v = ((v / 0x10000) | 0) + 2 * a2 * a7 + 2 * a3 * a6 + 2 * a4 * a5) & 0xFFFF;
    r[10] = (v = ((v / 0x10000) | 0) + 2 * a3 * a7 + 2 * a4 * a6 + a5 * a5) & 0xFFFF;
    r[11] = (v = ((v / 0x10000) | 0) + 2 * a4 * a7 + 2 * a5 * a6) & 0xFFFF;
    r[12] = (v = ((v / 0x10000) | 0) + 2 * a5 * a7 + a6 * a6) & 0xFFFF;
    r[13] = (v = ((v / 0x10000) | 0) + 2 * a6 * a7) & 0xFFFF;
    r[14] = (v = ((v / 0x10000) | 0) + a7 * a7) & 0xFFFF;
    r[15] = ((v / 0x10000) | 0);
    return r;
  }

  function c255lsqrmodp(r, a) {
    var x = c255lsqr8h(a[15], a[14], a[13], a[12], a[11], a[10], a[9], a[8]);
    var z = c255lsqr8h(a[7], a[6], a[5], a[4], a[3], a[2], a[1], a[0]);
    var y = c255lsqr8h(a[15] + a[7], a[14] + a[6], a[13] + a[5], a[12] + a[4], a[11] + a[3], a[10] + a[2], a[9] + a[1], a[8] + a[0]);

    var v;
    r[0] = (v = 0x800000 + z[0] + (y[8] - x[8] - z[8] + x[0] - 0x80) * 38) & 0xFFFF;
    r[1] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[1] + (y[9] - x[9] - z[9] + x[1]) * 38) & 0xFFFF;
    r[2] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[2] + (y[10] - x[10] - z[10] + x[2]) * 38) & 0xFFFF;
    r[3] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[3] + (y[11] - x[11] - z[11] + x[3]) * 38) & 0xFFFF;
    r[4] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[4] + (y[12] - x[12] - z[12] + x[4]) * 38) & 0xFFFF;
    r[5] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[5] + (y[13] - x[13] - z[13] + x[5]) * 38) & 0xFFFF;
    r[6] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[6] + (y[14] - x[14] - z[14] + x[6]) * 38) & 0xFFFF;
    r[7] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[7] + (y[15] - x[15] - z[15] + x[7]) * 38) & 0xFFFF;
    r[8] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[8] + y[0] - x[0] - z[0] + x[8] * 38) & 0xFFFF;
    r[9] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[9] + y[1] - x[1] - z[1] + x[9] * 38) & 0xFFFF;
    r[10] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[10] + y[2] - x[2] - z[2] + x[10] * 38) & 0xFFFF;
    r[11] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[11] + y[3] - x[3] - z[3] + x[11] * 38) & 0xFFFF;
    r[12] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[12] + y[4] - x[4] - z[4] + x[12] * 38) & 0xFFFF;
    r[13] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[13] + y[5] - x[5] - z[5] + x[13] * 38) & 0xFFFF;
    r[14] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[14] + y[6] - x[6] - z[6] + x[14] * 38) & 0xFFFF;
    var r15 = 0x7fff80 + ((v / 0x10000) | 0) + z[15] + y[7] - x[7] - z[7] + x[15] * 38;
    c255lreduce(r, r15);
  }

  function c255lmul8h(a7, a6, a5, a4, a3, a2, a1, a0, b7, b6, b5, b4, b3, b2, b1, b0) {
    var r = [];
    var v;
    r[0] = (v = a0 * b0) & 0xFFFF;
    r[1] = (v = ((v / 0x10000) | 0) + a0 * b1 + a1 * b0) & 0xFFFF;
    r[2] = (v = ((v / 0x10000) | 0) + a0 * b2 + a1 * b1 + a2 * b0) & 0xFFFF;
    r[3] = (v = ((v / 0x10000) | 0) + a0 * b3 + a1 * b2 + a2 * b1 + a3 * b0) & 0xFFFF;
    r[4] = (v = ((v / 0x10000) | 0) + a0 * b4 + a1 * b3 + a2 * b2 + a3 * b1 + a4 * b0) & 0xFFFF;
    r[5] = (v = ((v / 0x10000) | 0) + a0 * b5 + a1 * b4 + a2 * b3 + a3 * b2 + a4 * b1 + a5 * b0) & 0xFFFF;
    r[6] = (v = ((v / 0x10000) | 0) + a0 * b6 + a1 * b5 + a2 * b4 + a3 * b3 + a4 * b2 + a5 * b1 + a6 * b0) & 0xFFFF;
    r[7] = (v = ((v / 0x10000) | 0) + a0 * b7 + a1 * b6 + a2 * b5 + a3 * b4 + a4 * b3 + a5 * b2 + a6 * b1 + a7 * b0) & 0xFFFF;
    r[8] = (v = ((v / 0x10000) | 0) + a1 * b7 + a2 * b6 + a3 * b5 + a4 * b4 + a5 * b3 + a6 * b2 + a7 * b1) & 0xFFFF;
    r[9] = (v = ((v / 0x10000) | 0) + a2 * b7 + a3 * b6 + a4 * b5 + a5 * b4 + a6 * b3 + a7 * b2) & 0xFFFF;
    r[10] = (v = ((v / 0x10000) | 0) + a3 * b7 + a4 * b6 + a5 * b5 + a6 * b4 + a7 * b3) & 0xFFFF;
    r[11] = (v = ((v / 0x10000) | 0) + a4 * b7 + a5 * b6 + a6 * b5 + a7 * b4) & 0xFFFF;
    r[12] = (v = ((v / 0x10000) | 0) + a5 * b7 + a6 * b6 + a7 * b5) & 0xFFFF;
    r[13] = (v = ((v / 0x10000) | 0) + a6 * b7 + a7 * b6) & 0xFFFF;
    r[14] = (v = ((v / 0x10000) | 0) + a7 * b7) & 0xFFFF;
    r[15] = ((v / 0x10000) | 0);
    return r;
  }

  function c255lmulmodp(r, a, b) {
    // Karatsuba multiplication scheme: x*y = (b^2+b)*x1*y1 - b*(x1-x0)*(y1-y0) + (b+1)*x0*y0
    var x = c255lmul8h(a[15], a[14], a[13], a[12], a[11], a[10], a[9], a[8], b[15], b[14], b[13], b[12], b[11], b[10], b[9], b[8]);
    var z = c255lmul8h(a[7], a[6], a[5], a[4], a[3], a[2], a[1], a[0], b[7], b[6], b[5], b[4], b[3], b[2], b[1], b[0]);
    var y = c255lmul8h(a[15] + a[7], a[14] + a[6], a[13] + a[5], a[12] + a[4], a[11] + a[3], a[10] + a[2], a[9] + a[1], a[8] + a[0],
      b[15] + b[7], b[14] + b[6], b[13] + b[5], b[12] + b[4], b[11] + b[3], b[10] + b[2], b[9] + b[1], b[8] + b[0]);

    var v;
    r[0] = (v = 0x800000 + z[0] + (y[8] - x[8] - z[8] + x[0] - 0x80) * 38) & 0xFFFF;
    r[1] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[1] + (y[9] - x[9] - z[9] + x[1]) * 38) & 0xFFFF;
    r[2] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[2] + (y[10] - x[10] - z[10] + x[2]) * 38) & 0xFFFF;
    r[3] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[3] + (y[11] - x[11] - z[11] + x[3]) * 38) & 0xFFFF;
    r[4] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[4] + (y[12] - x[12] - z[12] + x[4]) * 38) & 0xFFFF;
    r[5] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[5] + (y[13] - x[13] - z[13] + x[5]) * 38) & 0xFFFF;
    r[6] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[6] + (y[14] - x[14] - z[14] + x[6]) * 38) & 0xFFFF;
    r[7] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[7] + (y[15] - x[15] - z[15] + x[7]) * 38) & 0xFFFF;
    r[8] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[8] + y[0] - x[0] - z[0] + x[8] * 38) & 0xFFFF;
    r[9] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[9] + y[1] - x[1] - z[1] + x[9] * 38) & 0xFFFF;
    r[10] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[10] + y[2] - x[2] - z[2] + x[10] * 38) & 0xFFFF;
    r[11] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[11] + y[3] - x[3] - z[3] + x[11] * 38) & 0xFFFF;
    r[12] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[12] + y[4] - x[4] - z[4] + x[12] * 38) & 0xFFFF;
    r[13] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[13] + y[5] - x[5] - z[5] + x[13] * 38) & 0xFFFF;
    r[14] = (v = 0x7fff80 + ((v / 0x10000) | 0) + z[14] + y[6] - x[6] - z[6] + x[14] * 38) & 0xFFFF;
    var r15 = 0x7fff80 + ((v / 0x10000) | 0) + z[15] + y[7] - x[7] - z[7] + x[15] * 38;
    c255lreduce(r, r15);
  }

  function c255lreduce(a, a15) {
    var v = a15;
    a[15] = v & 0x7FFF;
    v = ((v / 0x8000) | 0) * 19;
    for (var i = 0; i <= 14; ++i) {
      a[i] = (v += a[i]) & 0xFFFF;
      v = ((v / 0x10000) | 0);
    }

    a[15] += v;
  }

  function c255laddmodp(r, a, b) {
    var v;
    r[0] = (v = (((a[15] / 0x8000) | 0) + ((b[15] / 0x8000) | 0)) * 19 + a[0] + b[0]) & 0xFFFF;
    for (var i = 1; i <= 14; ++i)
      r[i] = (v = ((v / 0x10000) | 0) + a[i] + b[i]) & 0xFFFF;

    r[15] = ((v / 0x10000) | 0) + (a[15] & 0x7FFF) + (b[15] & 0x7FFF);
  }

  function c255lsubmodp(r, a, b) {
    var v;
    r[0] = (v = 0x80000 + (((a[15] / 0x8000) | 0) - ((b[15] / 0x8000) | 0) - 1) * 19 + a[0] - b[0]) & 0xFFFF;
    for (var i = 1; i <= 14; ++i)
      r[i] = (v = ((v / 0x10000) | 0) + 0x7fff8 + a[i] - b[i]) & 0xFFFF;

    r[15] = ((v / 0x10000) | 0) + 0x7ff8 + (a[15] & 0x7FFF) - (b[15] & 0x7FFF);
  }

  function c255lmulasmall(r, a, m) {
    var v;
    r[0] = (v = a[0] * m) & 0xFFFF;
    for (var i = 1; i <= 14; ++i)
      r[i] = (v = ((v / 0x10000) | 0) + a[i] * m) & 0xFFFF;

    var r15 = ((v / 0x10000) | 0) + a[15] * m;
    c255lreduce(r, r15);
  }

  //endregion

  /********************* Elliptic curve *********************/

  /* y^2 = x^3 + 486662 x^2 + x  over GF(2^255-19) */

  /* t1 = ax + az
   * t2 = ax - az  */
  function mont_prep(t1, t2, ax, az) {
    add(t1, ax, az);
    sub(t2, ax, az);
  }

  /* A = P + Q   where
   *  X(A) = ax/az
   *  X(P) = (t1+t2)/(t1-t2)
   *  X(Q) = (t3+t4)/(t3-t4)
   *  X(P-Q) = dx
   * clobbers t1 and t2, preserves t3 and t4  */
  function mont_add(t1, t2, t3, t4, ax, az, dx) {
    mul(ax, t2, t3);
    mul(az, t1, t4);
    add(t1, ax, az);
    sub(t2, ax, az);
    sqr(ax, t1);
    sqr(t1, t2);
    mul(az, t1, dx);
  }

  /* B = 2 * Q   where
   *  X(B) = bx/bz
   *  X(Q) = (t3+t4)/(t3-t4)
   * clobbers t1 and t2, preserves t3 and t4  */
  function mont_dbl(t1, t2, t3, t4, bx, bz) {
    sqr(t1, t3);
    sqr(t2, t4);
    mul(bx, t1, t2);
    sub(t2, t1, t2);
    mul_small(bz, t2, 121665);
    add(t1, t1, bz);
    mul(bz, t1, t2);
  }

  /* Y^2 = X^3 + 486662 X^2 + X
   * t is a temporary  */
  function x_to_y2(t, y2, x) {
    sqr(t, x);
    mul_small(y2, x, 486662);
    add(t, t, y2);
    add(t, t, C1);
    mul(y2, t, x);
  }

  /* P = kG   and  s = sign(P)/k  */
  function core(Px, s, k, Gx) {
    var dx = createUnpackedArray();
    var t1 = createUnpackedArray();
    var t2 = createUnpackedArray();
    var t3 = createUnpackedArray();
    var t4 = createUnpackedArray();
    var x = [createUnpackedArray(), createUnpackedArray()];
    var z = [createUnpackedArray(), createUnpackedArray()];
    var i, j;

    /* unpack the base */
    if (Gx !== null)
      unpack(dx, Gx);
    else
      set(dx, 9);

    /* 0G = point-at-infinity */
    set(x[0], 1);
    set(z[0], 0);

    /* 1G = G */
    cpy(x[1], dx);
    set(z[1], 1);

    for (i = 32; i-- !== 0;) {
      for (j = 8; j-- !== 0;) {
        /* swap arguments depending on bit */
        var bit1 = (k[i] & 0xFF) >> j & 1;
        var bit0 = ~(k[i] & 0xFF) >> j & 1;
        var ax = x[bit0];
        var az = z[bit0];
        var bx = x[bit1];
        var bz = z[bit1];

        /* a' = a + b	*/
        /* b' = 2 b	*/
        mont_prep(t1, t2, ax, az);
        mont_prep(t3, t4, bx, bz);
        mont_add(t1, t2, t3, t4, ax, az, dx);
        mont_dbl(t1, t2, t3, t4, bx, bz);
      }
    }

    recip(t1, z[0], 0);
    mul(dx, x[0], t1);

    pack(dx, Px);

    /* calculate s such that s abs(P) = G  .. assumes G is std base point */
    if (s !== null) {
      x_to_y2(t2, t1, dx); /* t1 = Py^2  */
      recip(t3, z[1], 0); /* where Q=P+G ... */
      mul(t2, x[1], t3); /* t2 = Qx  */
      add(t2, t2, dx); /* t2 = Qx + Px  */
      add(t2, t2, C486671); /* t2 = Qx + Px + Gx + 486662  */
      sub(dx, dx, C9); /* dx = Px - Gx  */
      sqr(t3, dx); /* t3 = (Px - Gx)^2  */
      mul(dx, t2, t3); /* dx = t2 (Px - Gx)^2  */
      sub(dx, dx, t1); /* dx = t2 (Px - Gx)^2 - Py^2  */
      sub(dx, dx, C39420360); /* dx = t2 (Px - Gx)^2 - Py^2 - Gy^2  */
      mul(t1, dx, BASE_R2Y); /* t1 = -Py  */

      if (is_negative(t1) !== 0)    /* sign is 1, so just copy  */
        cpy32(s, k);
      else            /* sign is -1, so negate  */
        mula_small(s, ORDER_TIMES_8, 0, k, 32, -1);

      /* reduce s mod q
       * (is this needed?  do it just in case, it's fast anyway) */
      //divmod((dstptr) t1, s, 32, order25519, 32);

      /* take reciprocal of s mod q */
      var temp1 = new Array(32);
      var temp2 = new Array(64);
      var temp3 = new Array(64);
      cpy32(temp1, ORDER);
      cpy32(s, egcd32(temp2, temp3, s, temp1));
      if ((s[31] & 0x80) !== 0)
        mula_small(s, s, 0, ORDER, 32, 1);

    }
  }

  /********* DIGITAL SIGNATURES *********/

  /* deterministic EC-KCDSA
   *
   *    s is the private key for signing
   *    P is the corresponding public key
   *    Z is the context data (signer public key or certificate, etc)
   *
   * signing:
   *
   *    m = hash(Z, message)
   *    x = hash(m, s)
   *    keygen25519(Y, NULL, x);
   *    r = hash(Y);
   *    h = m XOR r
   *    sign25519(v, h, x, s);
   *
   *    output (v,r) as the signature
   *
   * verification:
   *
   *    m = hash(Z, message);
   *    h = m XOR r
   *    verify25519(Y, v, h, P)
   *
   *    confirm  r === hash(Y)
   *
   * It would seem to me that it would be simpler to have the signer directly do
   * h = hash(m, Y) and send that to the recipient instead of r, who can verify
   * the signature by checking h === hash(m, Y).  If there are any problems with
   * such a scheme, please let me know.
   *
   * Also, EC-KCDSA (like most DS algorithms) picks x random, which is a waste of
   * perfectly good entropy, but does allow Y to be calculated in advance of (or
   * parallel to) hashing the message.
   */

  /* Signature generation primitive, calculates (x-h)s mod q
   *   h  [in]  signature hash (of message, signature pub key, and context data)
   *   x  [in]  signature private key
   *   s  [in]  private key for signing
   * returns signature value on success, undefined on failure (use different x or h)
   */

  function sign(h, x, s) {
    // v = (x - h) s  mod q
    var w, i;
    var h1 = new Array(32)
    var x1 = new Array(32);
    var tmp1 = new Array(64);
    var tmp2 = new Array(64);

    // Don't clobber the arguments, be nice!
    cpy32(h1, h);
    cpy32(x1, x);

    // Reduce modulo group order
    var tmp3 = new Array(32);
    divmod(tmp3, h1, 32, ORDER, 32);
    divmod(tmp3, x1, 32, ORDER, 32);

    // v = x1 - h1
    // If v is negative, add the group order to it to become positive.
    // If v was already positive we don't have to worry about overflow
    // when adding the order because v < ORDER and 2*ORDER < 2^256
    var v = new Array(32);
    mula_small(v, x1, 0, h1, 32, -1);
    mula_small(v, v, 0, ORDER, 32, 1);

    // tmp1 = (x-h)*s mod q
    mula32(tmp1, v, s, 32, 1);
    divmod(tmp2, tmp1, 64, ORDER, 32);

    for (w = 0, i = 0; i < 32; i++)
      w |= v[i] = tmp1[i];

    return w !== 0 ? v : undefined;
  }

  /* Signature verification primitive, calculates Y = vP + hG
   *   v  [in]  signature value
   *   h  [in]  signature hash
   *   P  [in]  public key
   *   Returns signature public key
   */
  function verify(v, h, P) {
    /* Y = v abs(P) + h G  */
    var d = new Array(32);
    var p = [createUnpackedArray(), createUnpackedArray()];
    var s = [createUnpackedArray(), createUnpackedArray()];
    var yx = [createUnpackedArray(), createUnpackedArray(), createUnpackedArray()];
    var yz = [createUnpackedArray(), createUnpackedArray(), createUnpackedArray()];
    var t1 = [createUnpackedArray(), createUnpackedArray(), createUnpackedArray()];
    var t2 = [createUnpackedArray(), createUnpackedArray(), createUnpackedArray()];

    var vi = 0, hi = 0, di = 0, nvh = 0, i, j, k;

    /* set p[0] to G and p[1] to P  */

    set(p[0], 9);
    unpack(p[1], P);

    /* set s[0] to P+G and s[1] to P-G  */

    /* s[0] = (Py^2 + Gy^2 - 2 Py Gy)/(Px - Gx)^2 - Px - Gx - 486662  */
    /* s[1] = (Py^2 + Gy^2 + 2 Py Gy)/(Px - Gx)^2 - Px - Gx - 486662  */

    x_to_y2(t1[0], t2[0], p[1]); /* t2[0] = Py^2  */
    sqrt(t1[0], t2[0]); /* t1[0] = Py or -Py  */
    j = is_negative(t1[0]); /*      ... check which  */
    add(t2[0], t2[0], C39420360); /* t2[0] = Py^2 + Gy^2  */
    mul(t2[1], BASE_2Y, t1[0]); /* t2[1] = 2 Py Gy or -2 Py Gy  */
    sub(t1[j], t2[0], t2[1]); /* t1[0] = Py^2 + Gy^2 - 2 Py Gy  */
    add(t1[1 - j], t2[0], t2[1]); /* t1[1] = Py^2 + Gy^2 + 2 Py Gy  */
    cpy(t2[0], p[1]); /* t2[0] = Px  */
    sub(t2[0], t2[0], C9); /* t2[0] = Px - Gx  */
    sqr(t2[1], t2[0]); /* t2[1] = (Px - Gx)^2  */
    recip(t2[0], t2[1], 0); /* t2[0] = 1/(Px - Gx)^2  */
    mul(s[0], t1[0], t2[0]); /* s[0] = t1[0]/(Px - Gx)^2  */
    sub(s[0], s[0], p[1]); /* s[0] = t1[0]/(Px - Gx)^2 - Px  */
    sub(s[0], s[0], C486671); /* s[0] = X(P+G)  */
    mul(s[1], t1[1], t2[0]); /* s[1] = t1[1]/(Px - Gx)^2  */
    sub(s[1], s[1], p[1]); /* s[1] = t1[1]/(Px - Gx)^2 - Px  */
    sub(s[1], s[1], C486671); /* s[1] = X(P-G)  */
    mul_small(s[0], s[0], 1); /* reduce s[0] */
    mul_small(s[1], s[1], 1); /* reduce s[1] */

    /* prepare the chain  */
    for (i = 0; i < 32; i++) {
      vi = (vi >> 8) ^ (v[i] & 0xFF) ^ ((v[i] & 0xFF) << 1);
      hi = (hi >> 8) ^ (h[i] & 0xFF) ^ ((h[i] & 0xFF) << 1);
      nvh = ~(vi ^ hi);
      di = (nvh & (di & 0x80) >> 7) ^ vi;
      di ^= nvh & (di & 0x01) << 1;
      di ^= nvh & (di & 0x02) << 1;
      di ^= nvh & (di & 0x04) << 1;
      di ^= nvh & (di & 0x08) << 1;
      di ^= nvh & (di & 0x10) << 1;
      di ^= nvh & (di & 0x20) << 1;
      di ^= nvh & (di & 0x40) << 1;
      d[i] = di & 0xFF;
    }

    di = ((nvh & (di & 0x80) << 1) ^ vi) >> 8;

    /* initialize state */
    set(yx[0], 1);
    cpy(yx[1], p[di]);
    cpy(yx[2], s[0]);
    set(yz[0], 0);
    set(yz[1], 1);
    set(yz[2], 1);

    /* y[0] is (even)P + (even)G
     * y[1] is (even)P + (odd)G  if current d-bit is 0
     * y[1] is (odd)P + (even)G  if current d-bit is 1
     * y[2] is (odd)P + (odd)G
     */

    vi = 0;
    hi = 0;

    /* and go for it! */
    for (i = 32; i-- !== 0;) {
      vi = (vi << 8) | (v[i] & 0xFF);
      hi = (hi << 8) | (h[i] & 0xFF);
      di = (di << 8) | (d[i] & 0xFF);

      for (j = 8; j-- !== 0;) {
        mont_prep(t1[0], t2[0], yx[0], yz[0]);
        mont_prep(t1[1], t2[1], yx[1], yz[1]);
        mont_prep(t1[2], t2[2], yx[2], yz[2]);

        k = ((vi ^ vi >> 1) >> j & 1)
          + ((hi ^ hi >> 1) >> j & 1);
        mont_dbl(yx[2], yz[2], t1[k], t2[k], yx[0], yz[0]);

        k = (di >> j & 2) ^ ((di >> j & 1) << 1);
        mont_add(t1[1], t2[1], t1[k], t2[k], yx[1], yz[1],
          p[di >> j & 1]);

        mont_add(t1[2], t2[2], t1[0], t2[0], yx[2], yz[2],
          s[((vi ^ hi) >> j & 2) >> 1]);
      }
    }

    k = (vi & 1) + (hi & 1);
    recip(t1[0], yz[k], 0);
    mul(t1[1], yx[k], t1[0]);

    var Y = [];
    pack(t1[1], Y);
    return Y;
  }

  /* Key-pair generation
   *   P  [out] your public key
   *   s  [out] your private key for signing
   *   k  [out] your private key for key agreement
   *   k  [in]  32 random bytes
   * s may be NULL if you don't care
   *
   * WARNING: if s is not NULL, this function has data-dependent timing */
  function keygen(k) {
    var P = [];
    var s = [];
    k = k || [];
    clamp(k);
    core(P, s, k, null);

    return { p: P, s: s, k: k };
  }

  return {
    sign: sign,
    verify: verify,
    keygen: keygen
  };
}();


/* 25519 end */


/* GGV start */
var GGV = (function (GGV, $) {

  GGV.getPublicKey = function (secretPhrase) {
    var secretPhraseBytes = converters.hexStringToByteArray(secretPhrase);
    var digest = simpleHash(secretPhraseBytes);
    return converters.byteArrayToHexString(curve25519.keygen(digest).p);
  };

  GGV.getPrivateKey = function (secretPhrase) {
    var bytes = simpleHash(converters.stringToByteArray(secretPhrase));
    return converters.shortArrayToHexString(curve25519_clamp(converters.byteArrayToShortArray(bytes)));
  };

  GGV.getAccountId = function (secretPhrase) {
    return GGV.getAccountIdFromPublicKey(GGV.getPublicKey(converters.stringToHexString(secretPhrase)));
  };

  GGV.getAccountIdFromPublicKey = function (publicKey, RSFormat) {
    var hex = converters.hexStringToByteArray(publicKey);
    var account = simpleHash(hex);

    account = converters.byteArrayToHexString(account);

    var slice = (converters.hexStringToByteArray(account)).slice(0, 8);

    var accountId = byteArrayToBigInteger(slice).toString();

    return accountId;

  };

  GGV.signBytes = function (message, secretPhrase) {
    var messageBytes = converters.hexStringToByteArray(message);
    var secretPhraseBytes = converters.hexStringToByteArray(secretPhrase);

    var digest = simpleHash(secretPhraseBytes);
    var s = curve25519.keygen(digest).s;
    var m = simpleHash(messageBytes);
    var x = simpleHash(m, s);
    var y = curve25519.keygen(x).p;
    var h = simpleHash(m, y);
    var v = curve25519.sign(h, x, s);
    return converters.byteArrayToHexString(v.concat(h));
  };

  GGV.verifySignature = function (signature, message, publicKey, callback) {
    var signatureBytes = converters.hexStringToByteArray(signature);
    var messageBytes = converters.hexStringToByteArray(message);
    var publicKeyBytes = converters.hexStringToByteArray(publicKey);
    var v = signatureBytes.slice(0, 32);
    var h = signatureBytes.slice(32);
    var y = curve25519.verify(v, h, publicKeyBytes);
    var m = simpleHash(messageBytes);
    var h2 = simpleHash(m, y);
    if (!areByteArraysEqual(h, h2)) {
      callback({
        "errorCode": 1,
        "errorDescription": $.t("error_signature_verification_client")
      }, message);
      return false;
    }
    return true;
  };

  GGV.simpleHash = function (b1, b2) {
    return simpleHash(b1, b2);
  }

  function simpleHash(b1, b2) {
    var sha256 = CryptoJS.algo.SHA256.create();
    sha256.update(converters.byteArrayToWordArray(b1));
    if (b2) {
      sha256.update(converters.byteArrayToWordArray(b2));
    }
    var hash = sha256.finalize();
    return converters.wordArrayToByteArrayImpl(hash, false);
  }

  function areByteArraysEqual(bytes1, bytes2) {
    if (bytes1.length !== bytes2.length) {
      return false;
    }
    for (var i = 0; i < bytes1.length; ++i) {
      if (bytes1[i] !== bytes2[i]) {
        return false;
      }
    }
    return true;
  }

  function curve25519_clamp(curve) {
    curve[0] &= 0xFFF8;
    curve[15] &= 0x7FFF;
    curve[15] |= 0x4000;
    return curve;
  }

  function byteArrayToBigInteger(byteArray) {
    var value = new BigInteger("0", 10);
    var temp1, temp2;
    for (var i = byteArray.length - 1; i >= 0; i--) {
      temp1 = value.multiply(new BigInteger("256", 10));
      temp2 = temp1.add(new BigInteger(byteArray[i].toString(10), 10));
      value = temp2;
    }
    return value;
  }

  function getSharedSecret(key1, key2) {
    return converters.shortArrayToByteArray(curve25519_(converters.byteArrayToShortArray(key1), converters.byteArrayToShortArray(key2), null));
  }

  GGV.sharedSecretToSharedKey = function (sharedSecret, nonce) {
    for (var i = 0; i < 32; i++) {
      sharedSecret[i] ^= nonce[i];
    }
    return simpleHash(sharedSecret);
  };

  GGV.getSharedKey = function (privateKey, publicKey, nonce) {
    var sharedSecret = getSharedSecret(privateKey, publicKey);
    return GGV.sharedSecretToSharedKey(sharedSecret, nonce);
  };


  return GGV;
}(GGV || {}));
/* GGV end*/

function getPublicKeySlice(publicKeyHex) {
  var hex = converters.hexStringToByteArray(publicKeyHex);
  var account = GGV.simpleHash(hex);
  account = converters.byteArrayToHexString(account);
  return account.slice(0, 16);
}

function calcNonce(userPkHex) {
  var time = Date.now();
  time = time - time % (1000 * 60 * 60 * 2);
  time = userPkHex + time;
  time = converters.stringToByteArray(time);
  var nonce = GGV.simpleHash(time);
  var x = converters.byteArrayToHexString(nonce);
  return nonce;
}

function createSharedKey(userSec, userPkHex) {
  var commonSecret = "http://www.vG0Resource.c0m";
  var commonSecHex = converters.stringToHexString(commonSecret);
  //
  var userPrivateKey = GGV.getPrivateKey(userSec);
  var commomPublicKey = GGV.getPublicKey(commonSecHex);
  commomPublicKey = converters.hexStringToByteArray(commomPublicKey);
  var userPk = converters.hexStringToByteArray(userPkHex);
  var nonce = calcNonce(userPkHex);
  //
  userPrivateKey = converters.hexStringToByteArray(userPrivateKey);

  var sharedKey = GGV.getSharedKey(userPrivateKey, commomPublicKey, nonce);
  sharedKey = converters.byteArrayToHexString(sharedKey);
  sharedKey = "1" + sharedKey.slice(0, 23);
  return sharedKey;
}


function calcAccountId(userSec) {
  var rsId = GGV.getAccountId(userSec);
  var address = new GGVAddress();
  if (address.set(rsId)) {
    rsId = address.toString();
  }
  return rsId
}

function getPublicKeyHex(userSec) {
  var userSecHex = converters.stringToHexString(userSec);
  var pubHex = GGV.getPublicKey(userSecHex);
  return pubHex;
}

function createPeerId(userSec) {
  var userSecHex = converters.stringToHexString(userSec);
  //
  var pubHex = GGV.getPublicKey(userSecHex);
  var peerTokenHex = createSharedKey(userSec, pubHex);
  //
  var rsId = GGV.getAccountId(userSec);
  var address = new GGVAddress();
  if (address.set(rsId)) {
    rsId = address.toString();
  }
  //create peerid
  var peerId = getPublicKeySlice(pubHex) + peerTokenHex;
  var account = { peerId: peerId, rsId: rsId, pk: pubHex, balance: 0 }
  return account
}

const get = require('simple-get')

function match(pk, sec) {
  var userSecHex = converters.stringToHexString(sec);
  var pubHex = GGV.getPublicKey(userSecHex);
  return pubHex === pk;
}


function loadAccountInfo(account, cb) {
  var host = 'https://127.0.0.1:12129'
  var url =host +  "/vgo?action=account&rsIdOrPkHex=" + account.pk;
  get.concat({ url: url, json: true }, function (err, res, account) {
    if (err) {
      console.log(err);
      return;
    }
    if (account.exist)
      cb(account)
    else
      cb(null);
  })
}


function shareResource(id, userSec, fee, deadline, price, tags, resName, showShareStatus) {

  var userSecHex = converters.stringToHexString(userSec);
  var aid = GGV.getAccountId(userSec);
  tags = converters.stringToHexString(tags)
  //
  var host = 'https://127.0.0.1:12129'
  var url = host + "/vgo?action=webTranaction&type=share";
  var data = { resId: id, accountId: aid, fee: fee + '', deadline: deadline + '', price: price + '', resName: resName };
  data = JSON.stringify(data);

  get.concat({ url: url, body: data }, function (err, rrr, res) {
    if (err) {
      //console.log(err);
      showShareStatus(false)
      return;
    }

    res = JSON.parse(res);

    if (res.ok) {
      var transctionBytes = res.transctionBytes;
      url = host + "/vgo?action=webTranaction&type=submit";
      var sig = GGV.signBytes("98000000" + transctionBytes, userSecHex);
      //112
      var part1 = transctionBytes.substring(0, 112);
      var part2 = transctionBytes.substring(112 + 128, transctionBytes.length);
      var transactionBytes = part1 + sig + part2;
      var request = { transactionBytes: transactionBytes, tags: tags }
      request = JSON.stringify(request);
      get.concat({ url: url, body: request }, function (err, rrr, res) {
        res = JSON.parse(res);
        showShareStatus(res.ok);
      })
    } else {
      showShareStatus(false);
    }

  })

}


function purchaseResource(id, userSec, fee, deadline, showPurchaseStatus) {

  var userSecHex = converters.stringToHexString(userSec);
  var aid = GGV.getAccountId(userSec);
  var address = new GGVAddress();
  var host = 'https://127.0.0.1:12129'
  //
  var url = host + "/vgo?action=webTranaction&type=buyres";
  var data = { resId: id, accountId: aid, fee: fee + '', deadline: deadline + '' };
  data = JSON.stringify(data);

  get.concat({ url: url, body: data }, function (err, rrr, res) {
    if (err) {
      console.log(err);
      showPurchaseStatus(false)
      return;
    }

    res = JSON.parse(res);

    if (res.ok) {
      var transctionBytes = res.transctionBytes;
      url = host + "/vgo?action=webTranaction&type=submit";
      var sig = GGV.signBytes("a0000000" + transctionBytes, userSecHex);
      //112
      var part1 = transctionBytes.substring(0, 112);
      var part2 = transctionBytes.substring(112 + 128, transctionBytes.length);
      var transactionBytes = part1 + sig + part2;
      var request = { transactionBytes: transactionBytes }
      request = JSON.stringify(request);
      get.concat({ url: url, body: request }, function (err, rrr, res) {
        res = JSON.parse(res);
        showPurchaseStatus(res.ok);
      })
    } else {
      showPurchaseStatus(false);
    }

  })

}


/**
*
*  URL encode / decode
*  http://www.webtoolkit.info/
*
**/

var Url = {

  // public method for url encoding
  encode: function (string) {
    return escape(this._utf8_encode(string));
  },

  // public method for url decoding
  decode: function (string) {
    return this._utf8_decode(unescape(string));
  },

  // private method for UTF-8 encoding
  _utf8_encode: function (string) {
    string = string.replace(/\r\n/g, "\n");
    var utftext = "";

    for (var n = 0; n < string.length; n++) {

      var c = string.charCodeAt(n);

      if (c < 128) {
        utftext += String.fromCharCode(c);
      }
      else if ((c > 127) && (c < 2048)) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      }
      else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }

    }

    return utftext;
  },

  // private method for UTF-8 decoding
  _utf8_decode: function (utftext) {
    var string = "";
    var i = 0;
    var c = 0;
    var c1 = 0;
    var c2 = 0;
    var c3 = 0;
    while (i < utftext.length) {

      c = utftext.charCodeAt(i);

      if (c < 128) {
        string += String.fromCharCode(c);
        i++;
      }
      else if ((c > 191) && (c < 224)) {
        c2 = utftext.charCodeAt(i + 1);
        string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
        i += 2;
      }
      else {
        c2 = utftext.charCodeAt(i + 1);
        c3 = utftext.charCodeAt(i + 2);
        string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
        i += 3;
      }

    }

    return string;
  }

}

function showQRDialog(resUrl) {
  var div = document.querySelector('#qrcode');
  var qrcode = new QRCode(div);
  qrcode.makeCode(resUrl);
}

function verifySignature(signature, message, publicKey, callback) {
  var messageHex = converters.stringToHexString(message)
  return GGV.verifySignature(signature, messageHex, publicKey, callback)
}

function signBytes(message, secretPhrase) {
  var messageHex = converters.stringToHexString(message)
  var secHex = converters.stringToHexString(secretPhrase)
  return GGV.signBytes(messageHex, secHex)
}
exports.signBytes = signBytes;
exports.createPeerId = createPeerId;
exports.getPublicKeyHex = getPublicKeyHex;
exports.loadAccountInfo = loadAccountInfo
exports.calcAccountId = calcAccountId
exports.purchaseResource = purchaseResource
exports.shareResource = shareResource
exports.Url = Url